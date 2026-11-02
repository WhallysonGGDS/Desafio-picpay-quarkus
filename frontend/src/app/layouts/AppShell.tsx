import { Link, NavLink, Outlet } from 'react-router-dom';
import { messageFor } from '../../api/errorMessages';
import { Button } from '../../design/Button';
import { Wordmark } from '../../design/Wordmark';
import { ROUTES } from '../../routes';
import { useLogout, useSession } from '../session';
import styles from './AppShell.module.css';

const ITEMS = [
  { to: ROUTES.wallet, label: 'Carteira' },
  { to: ROUTES.transfer, label: 'Transferir' },
  { to: ROUTES.statement, label: 'Extrato' },
] as const;

// Moldura das telas privadas. Uma única nav: no topo no desktop, e no celular uma barra fixa embaixo com os três itens
// (só o CSS muda de lugar; não há uma segunda nav).
export function AppShell() {
  const { user } = useSession();
  const logout = useLogout();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to={ROUTES.wallet} className={styles.brand} aria-label="arco, ir para a carteira">
          <Wordmark />
        </Link>
        <nav aria-label="Principal" className={styles.nav}>
          {ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={styles.link}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.account}>
          <span className={styles.name}>{user?.firstName}</span>
          <Button variant="quiet" loading={logout.isPending} onClick={() => logout.mutate()}>
            {logout.isPending ? 'Saindo…' : 'Sair'}
          </Button>
        </div>
      </header>
      {logout.isError && (
        <p role="alert" className={styles.alert}>
          Não deu para sair. {messageFor(logout.error)}
        </p>
      )}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
