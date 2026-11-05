import createClient, { type Middleware } from 'openapi-fetch';
import { API_ERROR_CODES, ApiError, type ApiErrorCode, type FieldError } from './ApiError';
import type { paths } from './schema';
import type { LoginBody, Page, RegisterBody, Transaction, TransferBody, User, UserSummary } from './types';

/** A única porta para o back-end: os componentes só conhecem estes métodos, e toda falha chega como ApiError. */
export interface Api {
  /** O usuário da sessão, ou null se não há sessão (401). Qualquer outra falha lança. */
  me(): Promise<User | null>;
  register(body: RegisterBody): Promise<User>;
  login(body: LoginBody): Promise<User>;
  logout(): Promise<void>;
  searchUsers(q: string): Promise<UserSummary[]>;
  transfer(body: TransferBody): Promise<Transaction>;
  statement(params: { direction: 'all' | 'sent' | 'received'; page: number; size: number }): Promise<Page<Transaction>>;
}

// Códigos que só existem no front: o servidor não os manda, e se mandasse não podem valer.
const SERVER_CODES = new Set<string>(API_ERROR_CODES.filter((code) => code !== 'NETWORK' && code !== 'UNKNOWN'));

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function fieldErrorsOf(value: unknown): FieldError[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is FieldError => isObject(item) && typeof item['field'] === 'string' && typeof item['code'] === 'string',
  );
}

// O corpo de erro do back-end é { statusCode, code, message, fieldErrors? }. Qualquer outra coisa (HTML de um proxy,
// JSON sem código) vira HTTP_<status>; um código que este front não conhece vira UNKNOWN, mantendo o status.
function toApiError(status: number, body: unknown): ApiError {
  if (isObject(body) && typeof body['code'] === 'string') {
    const code = body['code'];
    const known = SERVER_CODES.has(code) || /^HTTP_\d+$/.test(code);
    return new ApiError(status, known ? (code as ApiErrorCode) : 'UNKNOWN', fieldErrorsOf(body['fieldErrors']));
  }
  return new ApiError(status, `HTTP_${status}`, []);
}

// O back-end só aceita JSON nos POSTs (defesa contra CSRF), inclusive no logout, que não tem corpo.
const jsonPosts: Middleware = {
  onRequest({ request }) {
    if (request.method === 'POST' && !request.headers.has('Content-Type')) {
      request.headers.set('Content-Type', 'application/json');
    }
    return request;
  },
};

interface Outcome<D> {
  data?: D;
  error?: unknown;
  response: Response;
}

// Rede caída lança NETWORK; resposta de erro lança o ApiError do corpo; sucesso devolve o resultado.
async function outcomeOf<D>(call: Promise<Outcome<D>>): Promise<Outcome<D>> {
  let outcome: Outcome<D>;
  try {
    outcome = await call;
  } catch {
    throw new ApiError(0, 'NETWORK', []);
  }
  if (!outcome.response.ok) {
    throw toApiError(outcome.response.status, outcome.error);
  }
  return outcome;
}

// Para as chamadas que prometem um corpo: um 2xx sem ele é defeito do servidor, não um resultado válido.
async function bodyOf<D>(call: Promise<Outcome<D>>): Promise<D> {
  const { data, response } = await outcomeOf(call);
  if (data === undefined) {
    throw new ApiError(response.status, 'UNKNOWN', []);
  }
  return data;
}

/**
 * Prazo do envio. Sem resposta nele a chamada falha como NETWORK, e a tela diz "não deu para confirmar" (o envio pode ter
 * chegado: o extrato mostra). O back-end responde bem antes (o autorizador tem 3 s e a trava de saldo, 10 s), mas uma
 * conexão pendurada deixaria a tela em "Autorizando…" para sempre, e o fluxo fica travado enquanto há um envio a caminho.
 */
export const TRANSFER_TIMEOUT_MS = 20_000;

/**
 * Prazo das demais chamadas (a sessão, o login, a busca, o extrato). O back-end responde em milissegundos; sem resposta aqui a
 * chamada falha como NETWORK e a tela mostra o erro com "Tentar de novo", em vez de ficar na espera ou no esqueleto para
 * sempre (a sessão não repete sozinha). É menor que o do envio: nenhuma delas espera o autorizador.
 */
export const REQUEST_TIMEOUT_MS = 15_000;

// Roda a chamada com um prazo: passado o tempo, o fetch é abortado e a chamada falha como NETWORK. O relógio é desarmado ao fim,
// com resposta ou erro, para não deixar um timer por chamada.
async function within<T>(ms: number, call: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await call(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export function createApi(baseUrl: string = window.location.origin): Api {
  const client = createClient<paths>({
    baseUrl,
    credentials: 'same-origin',
    // fetch com ligação tardia: o openapi-fetch guarda o globalThis.fetch do instante da criação, e o `api` do
    // módulo é criado antes de qualquer ferramenta (os testes, por exemplo) trocar o fetch.
    fetch: (request) => globalThis.fetch(request),
  });
  client.use(jsonPosts);

  return {
    async me() {
      try {
        return await within(REQUEST_TIMEOUT_MS, (signal) => bodyOf(client.GET('/users/me', { signal })));
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 401) return null;
        throw error;
      }
    },
    async register(body) {
      return within(REQUEST_TIMEOUT_MS, (signal) => bodyOf(client.POST('/auth/register', { body, signal })));
    },
    async login(body) {
      return within(REQUEST_TIMEOUT_MS, (signal) => bodyOf(client.POST('/auth/login', { body, signal })));
    },
    async logout() {
      await within(REQUEST_TIMEOUT_MS, (signal) => outcomeOf(client.POST('/auth/logout', { signal })));
    },
    async searchUsers(q) {
      return within(REQUEST_TIMEOUT_MS, (signal) => bodyOf(client.GET('/users/search', { params: { query: { q } }, signal })));
    },
    async transfer(body) {
      return within(TRANSFER_TIMEOUT_MS, (signal) => bodyOf(client.POST('/transaction', { body, signal })));
    },
    async statement({ direction, page, size }) {
      return within(REQUEST_TIMEOUT_MS, (signal) => bodyOf(client.GET('/transaction', { params: { query: { direction, page, size } }, signal })));
    },
  };
}

export const api: Api = createApi();
