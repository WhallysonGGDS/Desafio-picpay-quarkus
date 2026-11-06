import { Fragment } from 'react';
import styles from '../showcase.module.css';

/**
 * Um título quebrado em linhas onde o sentido quebra. Cada linha é um bloco; o espaço de texto entre elas mantém a frase
 * inteira para quem a lê (leitor de tela, cópia): "Entre duas pessoas, um instante.", e não "pessoas,um".
 */
export function Lines({ lines }: { lines: readonly string[] }) {
  return (
    <>
      {lines.map((line, index) => (
        <Fragment key={line}>
          {index > 0 && ' '}
          <span className={styles.line}>{line}</span>
        </Fragment>
      ))}
    </>
  );
}
