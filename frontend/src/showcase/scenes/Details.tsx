import type { CSSProperties } from 'react';
import { COPY } from '../copy';
import { Scene } from '../Scene';
import styles from './Details.module.css';

/** 04 Detalhes: três linhas separadas por fios; cada uma aparece (opacidade e transform) quando a cena chega a ela. */
export function Details() {
  return (
    <Scene id={4} className={styles.details}>
      <ul className={styles.rows}>
        {COPY.details.map((row, index) => (
          <li key={row.term} className={styles.row} style={{ '--i': index } as CSSProperties}>
            <h3 className={styles.term}>{row.term}</h3>
            <p className={styles.detail}>{row.detail}</p>
          </li>
        ))}
      </ul>
    </Scene>
  );
}
