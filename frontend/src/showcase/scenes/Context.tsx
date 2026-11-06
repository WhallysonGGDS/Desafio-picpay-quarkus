import { COPY } from '../copy';
import { Scene } from '../Scene';
import { ScrollArc } from '../ScrollArc';
import styles from './Context.module.css';
import { Lines } from './Lines';

/**
 * 02 Contexto (fixa): quatro nós no arco, e cada um acende, com o seu texto, quando a luz passa. O texto fica DENTRO do arco
 * (onde há espaço); no celular o arco é vertical e o texto fica à direita dele.
 */
export function Context() {
  const labels = COPY.context.decisions.map((decision, index) => (
    <div className={styles.decision}>
      <span className={styles.index} aria-hidden="true">
        {String(index + 1).padStart(2, '0')}
      </span>
      <h3 className={styles.question}>{decision.question}</h3>
      <p className={styles.answer}>{decision.answer}</p>
    </div>
  ));

  return (
    <Scene id={2} pinned className={styles.context}>
      <h2 className={styles.title}>
        <Lines lines={COPY.context.lines} />
      </h2>
      <div className={styles.stage}>
        <ScrollArc orientation="auto" labels={labels} />
      </div>
    </Scene>
  );
}
