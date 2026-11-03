import type { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { User } from '../api/types';
import { createQueryClient } from '../app/providers';
import { server } from './server';

/** Resposta de erro no formato do back-end: { statusCode, code, message, fieldErrors? }. */
export function errorResponse(status: number, code: string, fieldErrors?: { field: string; code: string }[]) {
  return HttpResponse.json(
    { statusCode: status, code, message: 'texto do servidor', ...(fieldErrors ? { fieldErrors } : {}) },
    { status },
  );
}

/** O QueryClient do app para teste: nada repete sozinho, para o teste ver exatamente quantas chamadas aconteceram. */
export function testQueryClient(): QueryClient {
  return createQueryClient({ queries: { retry: false }, mutations: { retry: false } });
}

/** Registra o GET /users/me: o usuário dado, ou 401 (deslogado) se for null. */
export function mockSession(user: User | null): void {
  server.use(http.get('*/users/me', () => (user ? HttpResponse.json(user) : errorResponse(401, 'UNAUTHENTICATED'))));
}
