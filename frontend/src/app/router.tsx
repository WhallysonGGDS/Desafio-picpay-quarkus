import { lazy, Suspense } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { StatementPage } from '../features/statement/StatementPage';
import { TransferPage } from '../features/transfer/TransferPage';
import { WalletPage } from '../features/wallet/WalletPage';
import { ROUTES } from '../routes';
import { AppShell } from './layouts/AppShell';
import { PublicShell } from './layouts/PublicShell';
import { NotFound } from './pages/NotFound';
import { RouteError } from './pages/RouteError';
import { RedirectIfSignedIn } from './RedirectIfSignedIn';
import { RequireSession } from './RequireSession';
import { RouteFocus } from './RouteFocus';
import { Splash } from './Splash';

// A vitrine (GSAP, Lenis) é um chunk à parte: só quem abre a raiz o baixa.
const Showcase = lazy(() => import('../showcase/Showcase'));

export const routes: RouteObject[] = [
  {
    element: <RouteFocus />,
    errorElement: <RouteError />,
    children: [
      {
        path: ROUTES.home,
        element: (
          <Suspense fallback={<Splash />}>
            <Showcase />
          </Suspense>
        ),
      },
      {
        element: <RedirectIfSignedIn />,
        children: [
          {
            element: <PublicShell />,
            children: [
              { path: ROUTES.login, element: <LoginPage /> },
              { path: ROUTES.register, element: <RegisterPage /> },
            ],
          },
        ],
      },
      {
        element: <RequireSession />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: ROUTES.wallet, element: <WalletPage /> },
              { path: ROUTES.transfer, element: <TransferPage /> },
              { path: ROUTES.statement, element: <StatementPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
