import { MutationCache, QueryCache, QueryClient, QueryClientProvider, type DefaultOptions } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiError } from '../api/ApiError';
import { sessionKey } from './session';

/**
 * Uma consulta repete uma vez (uma queda de rede curta não vira tela de erro), menos com 401: a sessão acabou e repetir a
 * chamada não muda nada.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.statusCode === 401) return false;
  return failureCount < 1;
}

// Mutações nunca repetem sozinhas: reenviar uma transferência por conta própria seria cobrar duas vezes.
// networkMode "always": sem rede, a chamada FALHA na hora (o fetch do navegador rejeita), em vez de ficar PAUSADA até a rede voltar. Pausada,
// uma consulta ficava carregando para sempre sem dizer "sem conexão" e, pior, o envio de uma transferência ficava na fila e saía sozinho,
// minutos depois, com a pessoa em outra tela (e o botão travado em "Autorizando…", sem o prazo de 20 s, que só conta depois de sair).
const APP_DEFAULTS: DefaultOptions = {
  queries: { retry: shouldRetryQuery, networkMode: 'always' },
  mutations: { retry: false, networkMode: 'always' },
};

/**
 * O cliente do app. Os testes de tela o criam com os próprios padrões (nada repete sozinho), mas com o mesmo tratamento de
 * erros: o 401 de qualquer chamada, consulta ou mutação, é "a sessão acabou". A sessão vira null (a guarda de rotas leva a
 * /entrar?next=…) e o cache das outras consultas é descartado: quem entrar em seguida, na mesma aba, não pode ver o extrato
 * de quem ficou (o mesmo cuidado do Sair). Outras falhas (500, rede, regra de negócio) não mexem na sessão.
 */
export function createQueryClient(defaults: DefaultOptions = APP_DEFAULTS): QueryClient {
  const endSession = (error: unknown) => {
    if (!(error instanceof ApiError) || error.code !== 'UNAUTHENTICATED') return;
    client.setQueryData(sessionKey, null);
    client.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionKey[0] });
  };
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: endSession }),
    mutationCache: new MutationCache({ onError: endSession }),
    defaultOptions: defaults,
  });
  return client;
}

const queryClient = createQueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
