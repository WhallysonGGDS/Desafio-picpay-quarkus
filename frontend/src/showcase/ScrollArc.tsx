import { useRef, type CSSProperties, type ReactNode } from 'react';
import { ARC_H, ARC_V, pathData, pointOnArc, scaleArc, type Bezier } from './arcGeometry';
import styles from './showcase.module.css';
import { useElementSize } from './useElementSize';

export interface ScrollArcProps {
  /** `auto`: vertical no celular (menos de 768 px), horizontal a partir dali. */
  orientation?: 'horizontal' | 'vertical' | 'auto';
  /** Nós no arco, espalhados por igual ao longo do comprimento. Um por rótulo, se houver rótulos. */
  nodes?: number;
  /** O conteúdo de cada nó (um item por nó). Fica ao lado do ponto, que acende quando o traço de luz passa. */
  labels?: ReactNode[];
}

// Antes de medir (a primeira renderização, o jsdom) o arco usa esta caixa. A medida chega antes da primeira pintura.
const FALLBACK = { width: 1200, height: 400 };

const percent = (value: number, total: number) => `${((value / total) * 100).toFixed(3)}%`;

function ArcSvg({ kind, curve, width, height }: { kind: 'h' | 'v'; curve: Bezier; width: number; height: number }) {
  const d = pathData(curve);
  return (
    <svg
      className={kind === 'h' ? styles.svgH : styles.svgV}
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
 * espessura e falsearia o comprimento), para os dois arcos de uma vez: a caixa é a mesma, só um aparece por vez.
 */
export function ScrollArc({ orientation = 'auto', nodes, labels = [] }: ScrollArcProps) {
  const ref = useRef<HTMLDivElement>(null);
  const measured = useElementSize(ref);
  const { width, height } = measured && measured.width > 0 && measured.height > 0 ? measured : FALLBACK;
  const horizontal = scaleArc(ARC_H, width, height);
  const vertical = scaleArc(ARC_V, width, height);
  const count = nodes ?? labels.length;

  return (
    <div ref={ref} className={styles.arc} data-orientation={orientation}>
      {orientation !== 'vertical' && <ArcSvg kind="h" curve={horizontal} width={width} height={height} />}
      {orientation !== 'horizontal' && <ArcSvg kind="v" curve={vertical} width={width} height={height} />}
      {count > 0 && (
        <ol className={styles.nodes}>
          {Array.from({ length: count }, (_, index) => {
            // Espalhados por comprimento: o nó acende no instante em que a luz chega a ele.
            const t = (index + 1) / (count + 1);
            const [xh, yh] = pointOnArc(horizontal, t);
            const [xv, yv] = pointOnArc(vertical, t);
            const position = {
              '--t': t,
              '--xh': percent(xh, width),
              '--yh': percent(yh, height),
              '--xv': percent(xv, width),
              '--yv': percent(yv, height),
            } as CSSProperties;
            return (
              <li key={index} className={styles.node} style={position}>
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
