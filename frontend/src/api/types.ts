import type { components } from './schema';

// Os tipos vêm do contrato do back-end (schema.d.ts, gerado do OpenAPI): o que o servidor muda, o tsc acusa aqui.
type Schemas = components['schemas'];

export type User = Schemas['ResponseUser'];
export type UserSummary = Schemas['ResponseUserSummary'];
export type Transaction = Schemas['ResponseTransaction'];
export type RegisterBody = Schemas['RequestRegister'];
export type LoginBody = Schemas['RequestLogin'];
export type TransferBody = Schemas['RequestTransaction'];
export type ErrorBody = Schemas['ErrorResponseDTO'];

/** Uma página do extrato. Escrito à mão: o OpenAPI não expressa o genérico (só traz ResponsePageResponseTransaction). */
export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}
