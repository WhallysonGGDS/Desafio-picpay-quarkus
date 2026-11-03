import { useEffect } from 'react';

const SITE = 'Arco';

/**
 * O título da aba e do histórico ("Carteira | Arco"), que diz onde a pessoa está e é o que o leitor de tela lê ao trocar de
 * tela num app de uma página só (WCAG 2.4.2). Sem `page`, só o nome do site: a vitrine.
 */
export function useDocumentTitle(page?: string): void {
  useEffect(() => {
    document.title = page ? `${page} | ${SITE}` : SITE;
  }, [page]);
}
