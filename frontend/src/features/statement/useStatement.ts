import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '../../api/client';

/** O prefixo de todas as consultas de extrato: invalidá-lo atualiza todas de uma vez (depois de uma transferência). */
export const statementKey = ['statement'] as const;

export type StatementDirection = 'all' | 'sent' | 'received';

/**
 * O extrato, página a página. O tamanho faz parte da chave: a carteira pede 5 e o extrato pede 20, e as duas não
 * podem dividir o cache (o extrato abriria com as 5 da carteira e a paginação pularia as linhas de 6 a 20).
 */
export function useStatement(direction: StatementDirection, size = 20) {
  const query = useInfiniteQuery({
    queryKey: [...statementKey, direction, size],
    queryFn: ({ pageParam }) => api.statement({ direction, page: pageParam, size }),
    initialPageParam: 0,
    getNextPageParam: (last) => ((last.page + 1) * last.size < last.total ? last.page + 1 : undefined),
  });

  // A paginação é por deslocamento: uma transferência nova entre as páginas empurra as linhas e a página seguinte repete a última da
  // anterior. Cada movimento aparece uma vez (um extrato com linha repetida parece cobrança em duplicidade); o movimento novo entra
  // quando o extrato é recarregado.
  const items = useMemo(() => {
    const seen = new Set<number>();
    return (query.data?.pages ?? []).flatMap((page) => page.items).filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
  }, [query.data]);

  return {
    items,
    /** O total de movimentações (de todas as páginas), como o servidor o informa. */
    total: query.data?.pages[0]?.total ?? 0,
    /** Ainda não há nada para mostrar. */
    isLoading: query.isPending,
    /** A primeira carga falhou. Falha ao carregar mais fica em loadMoreError, e as linhas já carregadas ficam. */
    error: query.data === undefined && query.isError ? query.error : null,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMoreError: query.isFetchNextPageError ? query.error : null,
    loadMore: () => {
      void query.fetchNextPage();
    },
    retry: () => {
      void query.refetch();
    },
  };
}
