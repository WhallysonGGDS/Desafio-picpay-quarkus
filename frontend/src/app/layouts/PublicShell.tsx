import { Link, Outlet } from 'react-router-dom';
import { Wordmark } from '../../design/Wordmark';
import { ROUTES } from '../../routes';
import styles from './PublicShell.module.css';

// Moldura das telas de entrada (login e cadastro): a marca no canto e uma coluna estreita, o resto é espaço.
export function PublicShell() {
  return (
    <div className={styles.shell}>
      <header>
        <Link to={ROUTES.home} className={styles.brand} aria-label="arco, ir para o início">
          <Wordmark />
        </Link>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
