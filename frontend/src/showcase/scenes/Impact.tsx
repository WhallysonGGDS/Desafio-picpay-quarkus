import { useSession } from '../../app/session';
import { ButtonLink } from '../../design/Button';
import { Wordmark } from '../../design/Wordmark';
import { ROUTES } from '../../routes';
import { COPY } from '../copy';
import { Scene } from '../Scene';
import { ScrollArc } from '../ScrollArc';
import styles from './Impact.module.css';
import { Lines } from './Lines';

/** 01 Impacto: a tela quase vazia, uma frase, e um ponto de luz que traça o arco uma vez. */
export function Impact() {
  const { user } = useSession();

  return (
    <Scene id={1} className={styles.impact}>
      <header className={styles.top}>
        <Wordmark />
        <ButtonLink to={user ? ROUTES.wallet : ROUTES.login} variant="quiet">
          {user ? COPY.top.wallet : COPY.top.signIn}
        </ButtonLink>
      </header>
      <h1 className={styles.title}>
        <Lines lines={COPY.impact.lines} />
      </h1>
      <div className={styles.arc}>
        <ScrollArc orientation="horizontal" ends timed />
      </div>
      <p className={styles.scroll}>
        <span>{COPY.impact.scroll}</span>
        <span className={styles.rule} aria-hidden="true" />
      </p>
    </Scene>
  );
}
