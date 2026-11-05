import type { ApiError } from '../../api/ApiError';
import { fieldMessage, messageFor } from '../../api/errorMessages';
import { digitsOnly, isValidCnpj, isValidCpf, type DocumentKind } from '../../lib/document';

// A validação do cliente só poupa uma ida ao servidor: o servidor continua sendo a autoridade. Por isso o e-mail
// é conferido de forma frouxa (uma arroba, sem espaços), e quem decide se ele é válido é o back-end.

/** Os campos do cadastro, na ordem em que aparecem na tela (é a ordem em que o foco vai ao primeiro erro). */
export const REGISTER_FIELDS = ['firstName', 'lastName', 'email', 'document', 'password'] as const;
export type RegisterField = (typeof REGISTER_FIELDS)[number];
export type LoginField = 'email' | 'password';

/** Campo → código de erro (REQUIRED, INVALID_EMAIL...), o mesmo vocabulário que o servidor usa nos fieldErrors. */
export type FieldCodes<Field extends string> = Partial<Record<Field, string>>;

export interface RegisterForm {
  userType: DocumentKind;
  firstName: string;
  lastName: string;
  email: string;
  /** Como está na tela (com máscara). */
  document: string;
  password: string;
}

const MAX_NAME = 80;
const MAX_EMAIL = 160;
const PASSWORD_MIN = 8;
/** O máximo é em BYTES (UTF-8), como no servidor: o BCrypt só lê os 72 primeiros, e "é" tem 2 bytes. */
const PASSWORD_MAX = 72;

const utf8Bytes = (text: string): number => new TextEncoder().encode(text).length;

const isBlank = (text: string) => text.trim() === '';

function nameError(value: string): string | undefined {
  if (isBlank(value)) return 'REQUIRED';
  return value.trim().length > MAX_NAME ? 'TOO_LONG' : undefined;
}

function emailError(value: string): string | undefined {
  const email = value.trim();
  if (email === '') return 'REQUIRED';
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) return 'INVALID_EMAIL';
  return email.length > MAX_EMAIL ? 'TOO_LONG' : undefined;
}

export function validateRegister(form: RegisterForm): FieldCodes<RegisterField> {
  const digits = digitsOnly(form.document);
  const documentValid = form.userType === 'COMMON' ? isValidCpf(digits) : isValidCnpj(digits);

  const found: FieldCodes<RegisterField> = {
    firstName: nameError(form.firstName),
    lastName: nameError(form.lastName),
    email: emailError(form.email),
    document: digits === '' ? 'REQUIRED' : documentValid ? undefined : 'INVALID_DOCUMENT',
    // A senha não é aparada: o espaço faz parte dela.
    password:
      form.password === ''
        ? 'REQUIRED'
        : form.password.length < PASSWORD_MIN || utf8Bytes(form.password) > PASSWORD_MAX
          ? 'PASSWORD_LENGTH'
          : undefined,
  };
  return withoutUndefined(found);
}

export function validateLogin(email: string, password: string): FieldCodes<LoginField> {
  return withoutUndefined<LoginField>({
    email: isBlank(email) ? 'REQUIRED' : undefined,
    password: password === '' ? 'REQUIRED' : undefined,
  });
}

function withoutUndefined<Field extends string>(codes: FieldCodes<Field>): FieldCodes<Field> {
  return Object.fromEntries(Object.entries(codes).filter(([, code]) => code !== undefined)) as FieldCodes<Field>;
}

/** Códigos de erro → textos da tela. */
export function messagesOf<Field extends string>(codes: FieldCodes<Field>): Partial<Record<Field, string>> {
  return Object.fromEntries(Object.entries(codes).map(([field, code]) => [field, fieldMessage(code as string)])) as Partial<
    Record<Field, string>
  >;
}

const isRegisterField = (field: string): field is RegisterField => (REGISTER_FIELDS as readonly string[]).includes(field);

/**
 * O que o servidor apontou do cadastro, por campo, já com o texto da tela. E-mail e documento duplicados chegam só
 * com o `code` (sem fieldErrors); os demais erros de validação chegam em fieldErrors.
 */
export function serverMessages(error: ApiError): Partial<Record<RegisterField, string>> {
  const messages: Partial<Record<RegisterField, string>> = {};
  if (error.code === 'DUPLICATE_EMAIL') messages.email = messageFor(error);
  if (error.code === 'DUPLICATE_DOCUMENT') messages.document = messageFor(error);
  for (const { field, code } of error.fieldErrors) {
    if (isRegisterField(field) && messages[field] === undefined) messages[field] = fieldMessage(code);
  }
  return messages;
}
