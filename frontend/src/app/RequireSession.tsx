import { useQueryClient } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { ApiError } from '../api/ApiError';
import { messageFor } from '../api/errorMessages';
import { Button } from '../design/Button';
import { Wordmark } from '../design/Wordmark';
import { ROUTES } from '../routes';
import styles from './RequireSession.module.css';
import { Splash } from './Splash';
import { sessionEndKey, useSession } from './session';

function SessionError({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  return (
    <main className={styles.error}>
      <Wordmark />
      <h1 className={styles.title}>Não conseguimos abrir sua carteira.</h1>
      <p role="alert" className={styles.reason}>
        {messageFor(error)}
      </p>
      <Button onClick={onRetry}>Tentar de novo</Button>
    </main>
  );
}

// Guarda das telas privadas. Sem sessão, vai ao login levando o destino (?next=). Enquanto a sessão carrega, só a
// marca. Se não deu para saber se há sessão (500, rede), diz o que houve em vez de mandar ao login.
export function RequireSession() {
  const { user, isLoading, error, retry } = useSession();
  const location = useLocation();
  const queryClient = useQueryClient();

  if (isLoading) return <Splash />;
  if (error) return <SessionError error={error} onRetry={retry} />;
  if (!user) {
    // Quem saiu por vontade própria vai ao login sem `next` (ver sessionEndKey).
    if (queryClient.getQueryData(sessionEndKey) === 'logout') return <Navigate to={ROUTES.login} replace />;
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${ROUTES.login}?next=${next}`} replace />;
  }
  return <Outlet />;
}
