import { MutationObserver, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ApiError, type ApiErrorCode } from '../api/ApiError';
import { marina } from '../test/fixtures';
import { createQueryClient, shouldRetryQuery } from './providers';
import { sessionKey } from './session';

describe('createQueryClient (o cliente do app, não o de teste)', () => {
  // Quebra se: mutações passarem a repetir sozinhas. Uma transferência que falhou por rede seria reenviada sem a
  // pessoa saber, e se a primeira tivesse chegado o dinheiro sairia duas vezes. O primeiro intervalo de repetição
  // do TanStack é de 1 s, por isso a espera.
  it('uma mutação que falha nunca é repetida sozinha', async () => {
    const client = createQueryClient();
    let calls = 0;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => {
            calls += 1;
            throw new Error('rede');
          },
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });
    await new Promise((resolve) => setTimeout(resolve, 1300));

    expect(calls).toBe(1);
  });
});

// O 401 de qualquer chamada é "a sessão acabou": o app inteiro tem de saber, não só a tela que fez a chamada.
describe('createQueryClient: a sessão que acabou', () => {
  const client = () => createQueryClient({ queries: { retry: false }, mutations: { retry: false } });
  const failingQuery = (c: ReturnType<typeof client>, code: ApiErrorCode, status: number) =>
    c.fetchQuery({ queryKey: ['search', code], queryFn: () => Promise.reject(new ApiError(status, code)) }).catch(() => undefined);

  // Quebra se: um 401 numa consulta (extrato, busca) deixar a sessão como está: a guarda de rotas só vê a sessão, e a pessoa
  // ficaria numa tela que já não funciona.
  it('um 401 numa consulta derruba a sessão (a guarda leva ao login)', async () => {
    const c = client();
    c.setQueryData(sessionKey, marina);

    await failingQuery(c, 'UNAUTHENTICATED', 401);

    expect(c.getQueryData(sessionKey)).toBeNull();
  });

  // Quebra se: o cache das outras consultas sobreviver à sessão: quem entrar em seguida, na mesma aba, veria o extrato de quem
  // ficou (o mesmo cuidado do Sair).
  it('e descarta o cache das outras consultas', async () => {
    const c = client();
    c.setQueryData(sessionKey, marina);
    c.setQueryData(['statement', { direction: 'all' }], { content: [{ id: 1 }] });

    await failingQuery(c, 'UNAUTHENTICATED', 401);

    expect(c.getQueryData(['statement', { direction: 'all' }])).toBeUndefined();
  });

  // Quebra se: o mesmo 401 numa MUTAÇÃO (o envio, o Sair com a sessão já vencida) não valer: o tratamento é do cliente, não da
  // tela que o faz.
  it('o 401 de uma mutação também', async () => {
    const c = client();
    c.setQueryData(sessionKey, marina);

    await new MutationObserver(c, { mutationFn: () => Promise.reject(new ApiError(401, 'UNAUTHENTICATED')) }).mutate().catch(() => undefined);

    expect(c.getQueryData(sessionKey)).toBeNull();
  });

  // Quebra se: qualquer falha derrubar a sessão: um 500 ou a rede caída não são "deslogado", e a pessoa perderia a tela por
  // uma oscilação do servidor.
  it.each([
    ['INTERNAL_ERROR', 500],
    ['NETWORK', 0],
    ['INSUFFICIENT_BALANCE', 422],
    ['INVALID_CREDENTIALS', 401],
  ] as const)('%s não derruba a sessão', async (code, status) => {
    const c = client();
    c.setQueryData(sessionKey, marina);
    c.setQueryData(['statement'], { content: [] });

    await failingQuery(c, code, status);

    expect(c.getQueryData(sessionKey)).toEqual(marina);
    expect(c.getQueryData(['statement'])).toEqual({ content: [] });
  });
});

describe('shouldRetryQuery', () => {
  // Quebra se: uma consulta com 401 for repetida (uma chamada a mais que não muda nada) ou outra falha não for repetida uma vez
  // (uma queda de rede curta viraria tela de erro) ou for repetida sempre.
  it('repete uma vez qualquer falha, menos o 401', () => {
    expect(shouldRetryQuery(0, new ApiError(500, 'INTERNAL_ERROR'))).toBe(true);
    expect(shouldRetryQuery(0, new ApiError(0, 'NETWORK'))).toBe(true);
    expect(shouldRetryQuery(0, new TypeError('rede'))).toBe(true);
    expect(shouldRetryQuery(1, new ApiError(500, 'INTERNAL_ERROR'))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(401, 'UNAUTHENTICATED'))).toBe(false);
  });

  // Quebra se: o cliente do app não usar a regra acima (os testes de tela criam o dele com retry: false).
  it('é a regra das consultas do cliente do app', () => {
    expect(createQueryClient().getDefaultOptions().queries?.retry).toBe(shouldRetryQuery);
  });
});
