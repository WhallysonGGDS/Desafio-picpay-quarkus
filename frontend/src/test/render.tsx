import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import type { User } from '../api/types';
import { routes } from '../app/router';
import { mockSession, testQueryClient } from './api';

/**
 * Monta o app inteiro (as rotas reais) numa rota inicial, sem registrar a sessão: quem chama controla a resposta de
 * GET /users/me (com server.use) antes de montar. Devolve o router (para conferir a URL) e o queryClient.
 */
export function renderRoutes(route: string, tree: RouteObject[] = routes, queryClient: QueryClient = testQueryClient()) {
  const router = createMemoryRouter(tree, { initialEntries: [route] });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router, queryClient };
}

/** Como renderRoutes, já com a sessão pedida: um usuário, ou null para deslogado. */
export function renderApp(route: string, { user = null, tree }: { user?: User | null; tree?: RouteObject[] } = {}) {
  mockSession(user);
  return renderRoutes(route, tree);
}

/** A URL atual do router de teste, com a busca: "/entrar?next=%2Ftransferir". */
export function currentUrl(router: ReturnType<typeof createMemoryRouter>): string {
  return router.state.location.pathname + router.state.location.search;
}
