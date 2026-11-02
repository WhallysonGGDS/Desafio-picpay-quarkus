import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { errorResponse, mockSession, testQueryClient } from '../test/api';
import { marina } from '../test/fixtures';
import { server } from '../test/server';
import { sessionKey, useLogin, useLogout, useSession } from './session';

// Os hooks de sessão num QueryClient de teste e num roteador em memória; `where` guarda a URL atual.
function setup(route = '/carteira') {
  const queryClient = testQueryClient();
  const where = { current: '' };
  function Probe() {
    const location = useLocation();
    where.current = location.pathname + location.search;
    return null;
  }
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <Probe />
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return { queryClient, where, wrapper };
}

describe('useSession', () => {
  // Quebra se: o 401 virar erro, ou a consulta virar laço (um refetch a cada render derrubaria o servidor).
  it('401 em /users/me deixa user=null e consulta uma vez só', async () => {
    let calls = 0;
    server.use(
      http.get('*/users/me', () => {
        calls += 1;
        return errorResponse(401, 'UNAUTHENTICATED');
      }),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useSession(), { wrapper });

    expect(result.current).toMatchObject({ user: undefined, isLoading: true, error: null });
    await waitFor(() => expect(result.current.user).toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 100)); // um laço de refetch apareceria aqui

    expect(calls).toBe(1);
    expect(result.current).toMatchObject({ user: null, isLoading: false, error: null });
  });

  it('com sessão, devolve o usuário', async () => {
    mockSession(marina);
    const { result } = renderHook(() => useSession(), { wrapper: setup().wrapper });

    await waitFor(() => expect(result.current.user).toEqual(marina));
    expect(result.current).toMatchObject({ isLoading: false, error: null });
  });

  // Quebra se: um erro do servidor ou da rede virar "deslogado". A pessoa pode estar logada, e mandá-la ao login
  // esconderia a falha. A tela precisa saber que não dá para saber.
  it('se a consulta falha (500), fica sem usuário e com o erro, sem fingir que está deslogado', async () => {
    server.use(http.get('*/users/me', () => errorResponse(500, 'INTERNAL_ERROR')));
    const { result } = renderHook(() => useSession(), { wrapper: setup().wrapper });

    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.user).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toMatchObject({ code: 'INTERNAL_ERROR', statusCode: 500 });
  });

  it('retry consulta de novo e o erro some', async () => {
    server.use(http.get('*/users/me', () => errorResponse(500, 'INTERNAL_ERROR')));
    const { result } = renderHook(() => useSession(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    mockSession(marina);
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.user).toEqual(marina));
    expect(result.current.error).toBeNull();
  });

  // Quebra se: um refetch que falha (aba voltando a ter foco com a rede ruim) derrubar o app para a tela de erro
  // mesmo já sabendo quem é a pessoa.
  it('um refetch que falha mantém o usuário já conhecido', async () => {
    mockSession(marina);
    const { wrapper, queryClient } = setup();
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(marina));

    server.use(http.get('*/users/me', () => errorResponse(500, 'INTERNAL_ERROR')));
    await act(() => queryClient.invalidateQueries({ queryKey: sessionKey }));
    await waitFor(() => expect(queryClient.getQueryState(sessionKey)?.status).toBe('error'));

    expect(result.current.user).toEqual(marina);
    expect(result.current.error).toBeNull();
  });
});

describe('useLogin', () => {
  // Quebra se: o login não gravar o perfil devolvido (a tela seguinte não saberia quem entrou) ou pedir /users/me à toa.
  it('grava a sessão com o perfil devolvido, sem pedir /users/me de novo', async () => {
    let meCalls = 0;
    server.use(
      http.get('*/users/me', () => {
        meCalls += 1;
        return errorResponse(401, 'UNAUTHENTICATED');
      }),
      http.post('*/auth/login', () => HttpResponse.json(marina)),
    );
    const { wrapper, queryClient } = setup('/entrar');
    const { result } = renderHook(() => ({ session: useSession(), login: useLogin() }), { wrapper });
    await waitFor(() => expect(result.current.session.user).toBeNull());

    await act(() => result.current.login.mutateAsync({ email: 'marina@arco.demo', password: 'demo1234' }));

    expect(queryClient.getQueryData(sessionKey)).toEqual(marina); // gravado no cache, na hora
    await waitFor(() => expect(result.current.session.user).toEqual(marina)); // e entregue a quem observa
    expect(meCalls).toBe(1);
  });

  // Quebra se: um login recusado mexer na sessão ou engolir o erro (a tela precisa mostrar "E-mail ou senha incorretos").
  it('com senha errada não mexe na sessão e expõe o erro', async () => {
    mockSession(null);
    server.use(http.post('*/auth/login', () => errorResponse(401, 'INVALID_CREDENTIALS')));
    const { result } = renderHook(() => ({ session: useSession(), login: useLogin() }), { wrapper: setup('/entrar').wrapper });
    await waitFor(() => expect(result.current.session.user).toBeNull());

    await act(async () => {
      await result.current.login.mutateAsync({ email: 'marina@arco.demo', password: 'errada' }).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.login.error).toMatchObject({ code: 'INVALID_CREDENTIALS' }));
    expect(result.current.session.user).toBeNull();
  });
});

describe('useLogout', () => {
  // Quebra se: o cache da pessoa que saiu sobreviver. Quem entrar em seguida, na mesma aba, veria o extrato dela.
  it('limpa o cache, deixa a sessão nula e vai a /entrar', async () => {
    mockSession(marina);
    server.use(http.post('*/auth/logout', () => new HttpResponse(null, { status: 204 })));
    const { wrapper, queryClient, where } = setup('/carteira');
    const { result } = renderHook(() => ({ session: useSession(), logout: useLogout() }), { wrapper });
    await waitFor(() => expect(result.current.session.user).toEqual(marina));
    queryClient.setQueryData(['statement', 'all', 20], { items: [], page: 0, size: 20, total: 0 });

    await act(() => result.current.logout.mutateAsync());

    expect(queryClient.getQueryData(['statement', 'all', 20])).toBeUndefined();
    expect(queryClient.getQueryData(sessionKey)).toBeNull();
    expect(where.current).toBe('/entrar');
  });

  // Quebra se: um logout que o servidor não confirmou for tratado como feito. O cookie é HttpOnly: o JS não o apaga,
  // e a pessoa sairia achando que encerrou a sessão num computador onde ela continua viva.
  it('se a chamada falha, não limpa nada, não sai da página e expõe o erro', async () => {
    mockSession(marina);
    server.use(http.post('*/auth/logout', () => HttpResponse.error()));
    const { wrapper, queryClient, where } = setup('/carteira');
    const { result } = renderHook(() => ({ session: useSession(), logout: useLogout() }), { wrapper });
    await waitFor(() => expect(result.current.session.user).toEqual(marina));
    queryClient.setQueryData(['statement', 'all', 20], { items: [], page: 0, size: 20, total: 0 });

    await act(async () => {
      await result.current.logout.mutateAsync().catch(() => undefined);
    });

    await waitFor(() => expect(result.current.logout.error).toMatchObject({ code: 'NETWORK' }));
    expect(result.current.session.user).toEqual(marina);
    expect(queryClient.getQueryData(['statement', 'all', 20])).toBeDefined();
    expect(where.current).toBe('/carteira');
  });
});
