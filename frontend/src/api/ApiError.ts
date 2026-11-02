// Códigos estáveis de erro: os 14 do ErrorCode do back-end (um teste confere a lista) mais dois que só existem aqui,
// NETWORK (o pedido nem chegou ou a resposta não voltou) e UNKNOWN (o servidor mandou um código que este front não conhece).
export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'INVALID_CREDENTIALS',
  'UNAUTHENTICATED',
  'MERCHANT_CANNOT_SEND',
  'USER_NOT_FOUND',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'DUPLICATE_EMAIL',
  'DUPLICATE_DOCUMENT',
  'INSUFFICIENT_BALANCE',
  'SELF_TRANSFER',
  'AUTHORIZATION_DENIED',
  'AUTHORIZER_UNAVAILABLE',
  'INTERNAL_ERROR',
  'NETWORK',
  'UNKNOWN',
] as const;

/** Um dos códigos acima ou `HTTP_<status>`, para respostas sem corpo de erro (um proxy devolvendo 502 em HTML). */
export type ApiErrorCode = (typeof API_ERROR_CODES)[number] | `HTTP_${number}`;

export interface FieldError {
  field: string;
  code: string;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;
  readonly fieldErrors: FieldError[];
  /** Falha de rede, e não resposta do servidor: a tela trata os dois como estados diferentes. */
  readonly isNetwork: boolean;

  constructor(statusCode: number, code: ApiErrorCode, fieldErrors: FieldError[] = []) {
    super(`${code} (${statusCode})`);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.isNetwork = code === 'NETWORK';
  }

  /** O código de erro de um campo do formulário, se o servidor apontou esse campo. */
  fieldCode(field: string): string | undefined {
    return this.fieldErrors.find((error) => error.field === field)?.code;
  }
}
