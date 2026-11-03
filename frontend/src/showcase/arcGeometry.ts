// A geometria do arco da vitrine. O traço de luz é desenhado por comprimento (pathLength=1 e dashoffset), então a
// posição de um nó "a 40% do arco" também tem de ser por comprimento, e não pelo parâmetro da curva: assim o nó acende
// no instante em que a luz chega a ele. O arco é calculado nos pixels da caixa que a cena lhe dá (scaleArc), nunca
// esticado por um viewBox: esticar deforma a espessura do traço e falseia o comprimento. Funções puras, sem DOM.

export type Point = readonly [number, number];

export interface Bezier {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
}

/** Para telas largas, em frações da caixa: de baixo à esquerda, sobe até o meio e desce à direita (o topo fica a ~16%). */
export const ARC_H: Bezier = { p0: [0, 0.95], p1: [0.25, -0.1], p2: [0.75, -0.1], p3: [1, 0.95] };

/**
 * Para o celular, em frações da caixa: de cima para baixo, curvando de leve junto à borda esquerda, como um "(". O texto
 * dos nós fica à direita dele, com a largura toda da tela.
 */
export const ARC_V: Bezier = { p0: [0.2, 0], p1: [-0.02, 0.28], p2: [-0.02, 0.72], p3: [0.2, 1] };

/** A forma (em frações da caixa) levada para os pixels de uma caixa de `width` por `height`. */
export function scaleArc(shape: Bezier, width: number, height: number): Bezier {
  const scale = ([x, y]: Point): Point => [x * width, y * height];
  return { p0: scale(shape.p0), p1: scale(shape.p1), p2: scale(shape.p2), p3: scale(shape.p3) };
}

export function pathData({ p0, p1, p2, p3 }: Bezier): string {
  return `M${p0[0]} ${p0[1]} C${p1[0]} ${p1[1]}, ${p2[0]} ${p2[1]}, ${p3[0]} ${p3[1]}`;
}

/** O ponto da curva no parâmetro `u` (0 a 1). Não é uniforme em comprimento: para isso, `pointOnArc`. */
export function bezierAt({ p0, p1, p2, p3 }: Bezier, u: number): Point {
  const inverse = 1 - u;
  const a = inverse ** 3;
  const b = 3 * inverse ** 2 * u;
  const c = 3 * inverse * u ** 2;
  const d = u ** 3;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

/** O ponto a `t` (0 a 1) do COMPRIMENTO do arco, medido numa poligonal de `samples` trechos. */
export function pointOnArc(arc: Bezier, t: number, samples = 512): Point {
  if (!(t > 0)) return bezierAt(arc, 0);
  if (t >= 1) return bezierAt(arc, 1);

  const points = Array.from({ length: samples + 1 }, (_, index) => bezierAt(arc, index / samples));
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    const [x0, y0] = points[index - 1] as Point;
    const [x1, y1] = points[index] as Point;
    lengths.push((lengths[index - 1] as number) + Math.hypot(x1 - x0, y1 - y0));
  }

  const target = t * (lengths[lengths.length - 1] as number);
  let index = 1;
  while (index < lengths.length - 1 && (lengths[index] as number) < target) index += 1;

  const before = lengths[index - 1] as number;
  const span = (lengths[index] as number) - before;
  const ratio = span === 0 ? 0 : (target - before) / span;
  const [x0, y0] = points[index - 1] as Point;
  const [x1, y1] = points[index] as Point;
  return [x0 + (x1 - x0) * ratio, y0 + (y1 - y0) * ratio];
}
