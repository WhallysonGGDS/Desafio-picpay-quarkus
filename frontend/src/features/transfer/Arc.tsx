import styles from './Arc.module.css';

/**
 * `unconfirmed`: não se sabe se o envio aconteceu. O desenho é o de repouso (o arco não afirma nada), mas o anúncio
 * não é o de `idle`: "Pronto para enviar" convidaria ao reenvio que o fluxo proíbe.
 */
export type ArcState = 'idle' | 'authorizing' | 'landed' | 'retracted' | 'unconfirmed';

const ANNOUNCEMENT: Record<ArcState, string> = {
  idle: 'Pronto para enviar',
  authorizing: 'Autorizando…',
  landed: 'Enviado',
  retracted: 'Não enviado',
  unconfirmed: 'Sem confirmação',
};

// Um arco entre dois pontos. Os dois nós ficam nas pontas e o arco sobe entre eles.
const ORIGIN = { x: 6, y: 96 };
const TARGET = { x: 394, y: 96 };
const PATH = `M${ORIGIN.x} ${ORIGIN.y} C 100 0, 300 0, ${TARGET.x} ${TARGET.y}`;

/**
 * O motivo do Arco: a transferência como um arco de luz entre duas pessoas. Só aparece quando há valor em trânsito.
 * O traço de luz mede 1 (pathLength) para que o CSS o desenhe por proporção. O movimento está todo no CSS, ligado
 * ao `data-arc-state`: ocioso, o caminho em hairline; autorizando, um segmento de luz percorre o arco em laço;
 * pousou, o arco se desenha inteiro e o ponto de chegada pulsa; recuou, o traço se recolhe. O desenho é decorativo
 * (aria-hidden): quem usa leitor de tela ouve o estado.
 */
export function Arc({ state, from, to }: { state: ArcState; from: string; to: string }) {
  return (
    <div className={styles.arc} data-arc-state={state}>
      <svg className={styles.svg} viewBox="0 0 400 112" aria-hidden="true" focusable="false">
        <path className={styles.track} d={PATH} />
        <path className={styles.light} d={PATH} pathLength={1} />
        <circle className={styles.origin} cx={ORIGIN.x} cy={ORIGIN.y} r="3.5" />
        <circle className={styles.target} cx={TARGET.x} cy={TARGET.y} r="4" />
        <circle className={styles.arrived} cx={TARGET.x} cy={TARGET.y} r="4" />
        <circle className={styles.pulse} cx={TARGET.x} cy={TARGET.y} r="4" />
      </svg>
      <div className={styles.names}>
        <span className={styles.name}>{from}</span>
        <span className={`${styles.name} ${styles.destination}`}>{to}</span>
      </div>
      <span role="status" className="sr-only">
        {ANNOUNCEMENT[state]}
      </span>
    </div>
  );
}
