import { Link } from 'react-router-dom';
import { ButtonLink } from '../../design/Button';
import { Wordmark } from '../../design/Wordmark';
import { ROUTES } from '../../routes';
import styles from './NotFound.module.css';

export function NotFound() {
  return (
    <main className={styles.page}>
      <Link to={ROUTES.home} aria-label="arco, ir para o início" className={styles.brand}>
        <Wordmark />
      </Link>
      <h1 className={styles.title}>Essa página não existe.</h1>
      <p className={styles.hint}>O endereço pode estar errado, ou a página pode ter mudado de lugar.</p>
      <ButtonLink to={ROUTES.home} variant="quiet">
        Ir para o início
      </ButtonLink>
    </main>
  );
}
