import { useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { messageFor } from '../../api/errorMessages';
import { useRegister } from '../../app/session';
import { useDocumentTitle } from '../../app/useDocumentTitle';
import { Button, ButtonLink } from '../../design/Button';
import { Field } from '../../design/Field';
import { digitsOnly, maskDocumentInput, type DocumentKind } from '../../lib/document';
import { ROUTES } from '../../routes';
import styles from './auth.module.css';
import {
  messagesOf,
  REGISTER_FIELDS,
  serverMessages,
  validateRegister,
  type RegisterField,
  type RegisterForm,
} from './validation';

const KINDS: { value: DocumentKind; label: string }[] = [
  { value: 'COMMON', label: 'Pessoa' },
  { value: 'MERCHANT', label: 'Loja' },
];

const DOCUMENT_PLACEHOLDER: Record<DocumentKind, string> = {
  COMMON: '000.000.000-00',
  MERCHANT: '00.000.000/0000-00',
};

const EMPTY: RegisterForm = { userType: 'COMMON', firstName: '', lastName: '', email: '', document: '', password: '' };

// Depois de criar a conta (que já inicia a sessão), quem leva a pessoa ao destino é a guarda RedirectIfSignedIn:
// ao ?next= se for interno, ou à carteira.
export function RegisterPage() {
  useDocumentTitle('Criar minha carteira');
  const [params] = useSearchParams();
  const register = useRegister();
  const [form, setForm] = useState<RegisterForm>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<RegisterField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const inputs = useRef<Partial<Record<RegisterField, HTMLInputElement | null>>>({});
  const sending = useRef(false);

  const next = params.get('next');
  const loginTo = `${ROUTES.login}${next ? `?next=${encodeURIComponent(next)}` : ''}`;
  const documentLabel = form.userType === 'COMMON' ? 'CPF' : 'CNPJ';

  // Edita um campo e limpa o aviso dele: o erro antigo não fica grudado no que a pessoa já está corrigindo.
  function edit<K extends RegisterField>(field: K, value: RegisterForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function chooseKind(userType: DocumentKind) {
    setForm((current) => ({ ...current, userType, document: maskDocumentInput(current.document, userType) }));
    setErrors((current) => ({ ...current, document: undefined }));
  }

  function showAndFocus(messages: Partial<Record<RegisterField, string>>) {
    setErrors(messages);
    const first = REGISTER_FIELDS.find((field) => messages[field]);
    if (first) inputs.current[first]?.focus();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (sending.current) return;

    setFormError(null);
    const messages = messagesOf(validateRegister(form));
    if (Object.keys(messages).length > 0) return showAndFocus(messages);
    setErrors({});

    sending.current = true;
    register.mutate(
      {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        document: digitsOnly(form.document),
        email: form.email.trim(),
        password: form.password,
        userType: form.userType,
      },
      {
        onError: (error) => {
          const fromServer = serverMessages(error);
          if (Object.keys(fromServer).length > 0) showAndFocus(fromServer);
          else setFormError(messageFor(error));
        },
        onSettled: () => {
          sending.current = false;
        },
      },
    );
  }

  const register_ = (field: RegisterField) => (element: HTMLInputElement | null) => {
    inputs.current[field] = element;
  };

  return (
    <>
      <h1 className={styles.title}>Criar minha carteira</h1>
      <form className={styles.form} onSubmit={submit} noValidate>
        <fieldset className={styles.kind}>
          <legend className={styles.legend}>Eu sou</legend>
          <div className={styles.options}>
            {KINDS.map(({ value, label }) => (
              <label key={value} className={styles.option}>
                <input
                  type="radio"
                  name="userType"
                  value={value}
                  checked={form.userType === value}
                  onChange={() => chooseKind(value)}
                />
                <span className={styles.optionText}>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className={styles.pair}>
          <Field
            ref={register_('firstName')}
            label="Nome"
            autoComplete="given-name"
            value={form.firstName}
            error={errors.firstName}
            onChange={(event) => edit('firstName', event.target.value)}
          />
          <Field
            ref={register_('lastName')}
            label="Sobrenome"
            autoComplete="family-name"
            value={form.lastName}
            error={errors.lastName}
            onChange={(event) => edit('lastName', event.target.value)}
          />
        </div>
        <Field
          ref={register_('email')}
          label="E-mail"
          type="text"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={form.email}
          error={errors.email}
          onChange={(event) => edit('email', event.target.value)}
        />
        <Field
          ref={register_('document')}
          label={documentLabel}
          inputMode="numeric"
          autoComplete="off"
          placeholder={DOCUMENT_PLACEHOLDER[form.userType]}
          value={form.document}
          error={errors.document}
          onChange={(event) => edit('document', maskDocumentInput(event.target.value, form.userType))}
        />
        <Field
          ref={register_('password')}
          label="Senha"
          type="password"
          autoComplete="new-password"
          hint={errors.password ? undefined : 'De 8 a 72 caracteres.'}
          value={form.password}
          error={errors.password}
          onChange={(event) => edit('password', event.target.value)}
        />

        {formError && (
          <p role="alert" className={styles.alert}>
            {formError}
          </p>
        )}
        <div className={styles.actions}>
          <p className={styles.note}>Você começa com um saldo de demonstração.</p>
          <Button type="submit" arrow loading={register.isPending}>
            {register.isPending ? 'Criando…' : 'Criar minha carteira'}
          </Button>
        </div>
      </form>
      <div className={styles.switch}>
        <ButtonLink to={loginTo} variant="quiet">
          Já tenho conta
        </ButtonLink>
      </div>
    </>
  );
}
