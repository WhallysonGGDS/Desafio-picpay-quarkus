import { useRef, type CSSProperties, type ReactNode } from 'react';
import { ARC_H, ARC_V, pathData, pointOnArc, scaleArc, type Bezier } from './arcGeometry';
import styles from './showcase.module.css';
import { useElementSize } from './useElementSize';

export interface ScrollArcProps {
  /**
   * `auto`: pela PROPORÇÃO da caixa medida, não pela largura da janela. Caixa larga e baixa, arco horizontal; caixa alta e
   * estreita (o celular, o tablet em pé), vertical, com o texto dos nós à direita dele.
   */
  orientation?: 'horizontal' | 'vertical' | 'auto';
  /** Nós no arco, espalhados por igual ao longo do comprimento. Um por rótulo, se houver rótulos. */
  nodes?: number;
  /** O conteúdo de cada nó (um item por nó). Fica ao lado do ponto, que acende quando o traço de luz passa. */
  labels?: ReactNode[];
  /**
   * Marca as duas pontas: a partida (ponto cheio) e a chegada (anel que acende e pulsa quando a luz chega). Com
   * `[de, para]` também as nomeia. As pontas são decorativas: o que elas dizem o resto da cena já diz.
   */
  ends?: boolean | readonly [ReactNode, ReactNode];
  /** Desenha por tempo, uma vez, ao carregar (a abertura), em vez de por `--p`. */
  timed?: boolean;
}

// Antes de medir (a primeira renderização, o jsdom) o arco usa esta caixa. A medida chega antes da primeira pintura.
const FALLBACK = { width: 1200, height: 400 };

// Abaixo desta proporção (largura / altura) a caixa é "em pé": o arco horizontal ficaria alto e estreito, com os flancos
// quase verticais, e o texto dos nós o atravessaria.
const UPRIGHT = 1.25;

const percent = (value: number, total: number) => `${((value / total) * 100).toFixed(3)}%`;

function ArcSvg({ kind, curve, width, height }: { kind: 'h' | 'v'; curve: Bezier; width: number; height: number }) {
  const d = pathData(curve);
  return (
    <svg
      data-arc={kind}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path className={styles.track} d={d} pathLength={1} />
      <path className={styles.light} d={d} pathLength={1} />
      <path className={styles.halo} d={d} pathLength={1} />
      <path className={styles.head} d={d} pathLength={1} />
    </svg>
  );
}

/**
 * O arco de luz da vitrine: um caminho que o scroll desenha. O traço mede 1 (pathLength) e o CSS o desenha por `--p`, a
 * variável de progresso da cena que o contém: `stroke-dashoffset: calc(1 - var(--p))`. A cabeça do traço (o ponto de
 * luz) anda no mesmo `--p`. A curva é calculada nos pixels da caixa medida (nada de viewBox esticado, que deformaria a
 * espessura e falsearia o comprimento), e a orientação, no modo auto, sai da proporção dessa caixa.
 */
export function ScrollArc({ orientation = 'auto', nodes, labels = [], ends = false, timed = false }: ScrollArcProps) {
  const ref = useRef<HTMLDivElement>(null);
  const measured = useElementSize(ref);
  const { width, height } = measured && measured.width > 0 && measured.height > 0 ? measured : FALLBACK;
  const resolved = orientation === 'auto' ? (width / height < UPRIGHT ? 'vertical' : 'horizontal') : orientation;
  const curve = scaleArc(resolved === 'vertical' ? ARC_V : ARC_H, width, height);
  const count = nodes ?? labels.length;

  // A posição de um ponto do arco desenhado (a `t` do comprimento), em porcentagem da caixa.
  const positionAt = (t: number) => {
    const [x, y] = pointOnArc(curve, t);
    return { '--t': t, '--x': percent(x, width), '--y': percent(y, height) } as CSSProperties;
  };
  const [fromLabel, toLabel] = Array.isArray(ends) ? ends : [undefined, undefined];

  return (
    <div ref={ref} className={styles.arc} data-orientation={resolved} data-timed={timed ? '' : undefined}>
      <ArcSvg kind={resolved === 'vertical' ? 'v' : 'h'} curve={curve} width={width} height={height} />
      {ends && (
        <>
          <div className={styles.end} data-end="origin" style={positionAt(0)} aria-hidden="true">
            <span className={styles.origin} />
            {fromLabel !== undefined && <span className={styles.endLabel}>{fromLabel}</span>}
          </div>
          <div className={styles.end} data-end="target" style={positionAt(1)} aria-hidden="true">
            <span className={styles.pulse} />
            <span className={styles.target} />
            <span className={styles.arrived} />
            {toLabel !== undefined && <span className={styles.endLabel}>{toLabel}</span>}
          </div>
        </>
      )}
      {count > 0 && (
        <ol className={styles.nodes}>
          {Array.from({ length: count }, (_, index) => {
            // Espalhados por comprimento: o nó acende no instante em que a luz chega a ele.
            const t = (index + 1) / (count + 1);
            // O texto vai para DENTRO do arco: nos flancos (onde o arco é inclinado) ao lado do nó, e no meio, onde ele é
            // quase plano, logo abaixo.
            const side = t < 0.35 ? 'start' : t > 0.65 ? 'end' : 'middle';
            return (
              <li key={index} className={styles.node} style={positionAt(t)} data-side={side}>
                <span className={styles.dot} aria-hidden="true" />
                {labels[index]}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
