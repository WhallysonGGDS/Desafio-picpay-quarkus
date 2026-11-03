import { COPY } from '../copy';
import { Scene } from '../Scene';
import { ScrollArc } from '../ScrollArc';
import styles from './Climax.module.css';

/** 05 Clímax: o arco fecha, o destino acende, e "Enviado." ocupa o quadro. */
export function Climax() {
  return (
    <Scene id={5} className={styles.climax}>
      <div className={styles.arc}>
        <ScrollArc orientation="horizontal" ends />
      </div>
      <h2 className={styles.word}>{COPY.climax.word}</h2>
      <p className={styles.line}>{COPY.climax.line}</p>
    </Scene>
  );
}
