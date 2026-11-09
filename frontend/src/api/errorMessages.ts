import { ApiError, type API_ERROR_CODES } from './ApiError';

const GENERIC = 'Não foi possível concluir. Tente de novo.';

// Um único mapa código → texto. Tipado como Record dos códigos conhecidos: código novo sem texto não compila.
const MESSAGES: Record<(typeof API_ERROR_CODES)[number], string> = {
  VALIDATION_ERROR: 'Confira os dados informados.',
  INVALID_CREDENTIALS: 'E-mail ou senha incorretos.',
  UNAUTHENTICATED: 'Sua sessão terminou. Entre de novo.',
  MERCHANT_CANNOT_SEND: 'Lojas recebem transferências, mas não enviam.',
  USER_NOT_FOUND: 'Não encontramos essa pessoa.',
  NOT_FOUND: 'Não encontramos o que você procura.',
  METHOD_NOT_ALLOWED: 'Essa ação não é permitida.',
  DUPLICATE_EMAIL: 'Já existe uma carteira com esse e-mail.',
  DUPLICATE_DOCUMENT: 'Já existe uma carteira com esse documento.',
  INSUFFICIENT_BALANCE: 'Saldo insuficiente para este valor.',
  SELF_TRANSFER: 'Você não pode enviar dinheiro para si mesmo.',
  AUTHORIZATION_DENIED: 'O serviço de autorização recusou esta transferência. Seu saldo não mudou.',
  AUTHORIZER_UNAVAILABLE: 'O serviço de autorização está fora do ar. Seu saldo não mudou. Tente de novo em instantes.',
  INTERNAL_ERROR: 'Algo deu errado do nosso lado. Tente de novo.',
  NETWORK: 'Sem conexão com o servidor.',
  UNKNOWN: GENERIC,
};

const FIELD_MESSAGES: Record<string, string> = {
  REQUIRED: 'Preencha este campo.',
  TOO_LONG: 'Texto longo demais.',
  INVALID_EMAIL: 'E-mail inválido.',
  // O máximo é em bytes (UTF-8, o limite do BCrypt): quem usa acentos e emojis chega nele com menos de 72 caracteres.
  PASSWORD_LENGTH: 'A senha precisa ter pelo menos 8 caracteres e no máximo 72 bytes (acentos e emojis ocupam mais de um).',
  INVALID_DOCUMENT: 'Documento inválido.',
  QUERY_TOO_SHORT: 'Digite ao menos 3 caracteres.',
  INVALID_AMOUNT: 'Digite um valor válido, com até duas casas decimais.',
};

/** O texto de um código de erro, para quem guarda o código e não o erro. `HTTP_<status>` e códigos desconhecidos caem no genérico. */
export function messageForCode(code: string): string {
  return (MESSAGES as Record<string, string>)[code] ?? GENERIC;
}

/** O texto de um erro para a tela. `HTTP_<status>` e qualquer coisa que não seja ApiError caem no texto genérico. */
export function messageFor(error: unknown): string {
  return error instanceof ApiError ? messageForCode(error.code) : GENERIC;
}

/** O texto de um erro de campo (o `code` de um item de fieldErrors). */
export function fieldMessage(code: string): string {
  return FIELD_MESSAGES[code] ?? 'Valor inválido.';
}
