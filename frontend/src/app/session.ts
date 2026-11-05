import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { ApiError } from '../api/ApiError';
import type { LoginBody, RegisterBody, User } from '../api/types';
import { ROUTES } from '../routes';

export const sessionKey = ['session'] as const;

/**
 * Por que a sessão acabou, quando foi a própria pessoa que saiu (`'logout'`). A guarda das telas privadas lê isto para mandar quem
 * saiu ao login SEM o `next`: sem isto, ela e o Sair disputavam o destino (o Sair vai a /entrar; a guarda, que vê a sessão virar
 * null enquanto a tela de onde se sai ainda está montada, vai a /entrar?next=...), quem chegava primeiro dependia da velocidade da
 * máquina, e a próxima pessoa a entrar podia cair na página da anterior. Uma sessão que vence (401) não deixa marcador.
 */
export const sessionEndKey = ['session-end'] as const;

export interface Session {
  /** `undefined`: ainda não se sabe (carregando, ou a consulta falhou). `null`: deslogado. */
  user: User | null | undefined;
  isLoading: boolean;
  /** Só quando não há dado nenhum: um refetch que falha com o usuário já conhecido não vira erro. */
  error: ApiError | null;
  retry: () => void;
}

/**
 * Quem está logado, perguntado ao servidor (o front nunca toca o token, que vive num cookie HttpOnly).
 * 401 é "deslogado" (null). Qualquer outra falha NÃO é "deslogado": a pessoa pode estar logada, e quem usa o
 * hook decide mostrar o erro. Sem repetição automática: quem decide tentar de novo é a pessoa.
 */
export function useSession(): Session {
  const query = useQuery<User | null, ApiError>({
    queryKey: sessionKey,
    queryFn: () => api.me(),
    staleTime: 30_000,
    retry: false,
  });
  return {
    user: query.data,
    isLoading: query.isPending,
    error: query.data === undefined && query.isError ? query.error : null,
    retry: () => {
      void query.refetch();
    },
  };
}

// Entrar e criar conta já devolvem o perfil: grava direto, sem outra ida ao servidor.
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation<User, ApiError, LoginBody>({
    mutationFn: (body) => api.login(body),
    onSuccess: (user) => {
      queryClient.removeQueries({ queryKey: sessionEndKey });
      queryClient.setQueryData(sessionKey, user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation<User, ApiError, RegisterBody>({
    mutationFn: (body) => api.register(body),
    onSuccess: (user) => {
      queryClient.removeQueries({ queryKey: sessionEndKey });
      queryClient.setQueryData(sessionKey, user);
    },
  });
}

/**
 * Só sai quando o servidor confirma: o cookie é HttpOnly e o JS não consegue apagá-lo. Fingir a saída com a rede
 * caída deixaria a sessão viva num computador que a pessoa acha que deixou. Ao sair, o cache de todas as outras
 * consultas é descartado (quem entrar em seguida, na mesma aba, não pode ver o extrato de quem saiu).
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation<void, ApiError>({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      navigate(ROUTES.login, { replace: true });
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionKey[0] });
      // O marcador entra DEPOIS da limpeza acima e ANTES de a sessão ir a null: a guarda lê o marcador no render que a sessão nula provoca.
      queryClient.setQueryData(sessionEndKey, 'logout');
      queryClient.setQueryData(sessionKey, null);
    },
  });
}
