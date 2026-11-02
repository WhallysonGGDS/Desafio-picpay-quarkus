import { Navigate, Outlet, useSearchParams } from 'react-router-dom';
import { Splash } from './Splash';
import { safeNext } from './safeNext';
import { useSession } from './session';

// Guarda das telas públicas de entrada: quem já tem sessão não precisa delas e vai ao destino pedido (só um caminho
// interno vale) ou à carteira. Se a consulta da sessão falhou, a tela pública abre: a pessoa pode tentar entrar.
export function RedirectIfSignedIn() {
  const { user, isLoading } = useSession();
  const [params] = useSearchParams();

  if (isLoading) return <Splash />;
  if (user) return <Navigate to={safeNext(params.get('next'))} replace />;
  return <Outlet />;
}
