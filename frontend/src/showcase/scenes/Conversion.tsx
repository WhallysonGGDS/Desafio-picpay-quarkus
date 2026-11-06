import { useSession } from '../../app/session';
import { ButtonLink } from '../../design/Button';
import { ROUTES } from '../../routes';
import { COPY } from '../copy';
import { Scene } from '../Scene';
import styles from './Conversion.module.css';

/** 06 Conversão: o convite e um único próximo passo. Quem já tem sessão vai direto à carteira. */
export function Conversion() {
  const { user } = useSession();

  return (
    <Scene id={6} className={styles.conversion}>
      <h2 className={styles.title}>{COPY.conversion.title}</h2>
      <div className={styles.actions}>
        <ButtonLink to={user ? ROUTES.wallet : ROUTES.register} arrow className={styles.cta}>
          {COPY.conversion.cta}
        </ButtonLink>
        {!user && (
          <ButtonLink to={ROUTES.login} variant="quiet">
            {COPY.conversion.login}
          </ButtonLink>
        )}
      </div>
      <footer className={styles.credit}>{COPY.conversion.credit}</footer>
    </Scene>
  );
}
