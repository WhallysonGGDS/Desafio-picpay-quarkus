import { describe, expect, it } from 'vitest';
import { ARC_H, ARC_V, bezierAt, pathData, pointOnArc, scaleArc, type Bezier } from './arcGeometry';

describe('pathData', () => {
  // Quebra se: o `d` do SVG sair com outra forma que o navegador não leia (o arco sumiria sem erro nenhum).
  it('escreve o caminho cúbico como M x y C ...', () => {
    expect(pathData({ p0: [0, 10], p1: [1, 2], p2: [3, 4], p3: [5, 6] })).toBe('M0 10 C1 2, 3 4, 5 6');
  });
});

describe('scaleArc', () => {
  // Quebra se: a caixa medida não chegar à curva (o arco ficaria do tamanho da forma, de 0 a 1 pixel) ou os eixos se trocarem.
  it('leva as frações da forma para os pixels da caixa, cada eixo no seu tamanho', () => {
    const scaled = scaleArc({ p0: [0, 0.5], p1: [0.25, 0], p2: [0.75, 1], p3: [1, 0.5] }, 800, 200);

    expect(scaled).toEqual({ p0: [0, 100], p1: [200, 0], p2: [600, 200], p3: [800, 100] });
  });
});

describe('bezierAt', () => {
  it('começa e termina nas pontas', () => {
    expect(bezierAt(ARC_H, 0)).toEqual(ARC_H.p0);
    expect(bezierAt(ARC_H, 1)).toEqual(ARC_H.p3);
  });
});

// As caixas que as cenas dão ao arco: larga e baixa (notebook), quase quadrada (tablet), estreita e alta (celular). O que
// vale para uma vale para todas: o comprimento é medido nos pixels, não na forma.
describe.each([
  ['horizontal 1200×400', scaleArc(ARC_H, 1200, 400)],
  ['horizontal 1366×300 (larga e baixa)', scaleArc(ARC_H, 1366, 300)],
  ['horizontal 768×640', scaleArc(ARC_H, 768, 640)],
  ['vertical 358×700', scaleArc(ARC_V, 358, 700)],
  ['vertical 300×1000 (estreita e alta)', scaleArc(ARC_V, 300, 1000)],
] as [string, Bezier][])('pointOnArc (%s)', (_name, arc) => {
  // Quebra se: os nós saírem do arco (cada ponta do caminho tem de ser uma ponta da posição).
  it('t = 0 e t = 1 são as pontas do arco', () => {
    const [x0, y0] = pointOnArc(arc, 0);
    const [x1, y1] = pointOnArc(arc, 1);

    expect(x0).toBeCloseTo(arc.p0[0], 6);
    expect(y0).toBeCloseTo(arc.p0[1], 6);
    expect(x1).toBeCloseTo(arc.p3[0], 6);
    expect(y1).toBeCloseTo(arc.p3[1], 6);
  });

  // Quebra se: a posição for por parâmetro da curva e não por comprimento: o nó acenderia antes ou depois de a luz chegar
  // (o traço de luz é desenhado por comprimento, com pathLength=1). O arco é simétrico, então t = 0,5 é o meio dele.
  it('é por comprimento de arco: t = 0,5 cai no centro de um arco simétrico', () => {
    const [mx, my] = pointOnArc(arc, 0.5);

    // os arcos horizontais são simétricos em x; os verticais, em y
    if (arc.p0[1] === arc.p3[1]) expect(mx).toBeCloseTo((arc.p0[0] + arc.p3[0]) / 2, 0);
    if (arc.p0[0] === arc.p3[0]) expect(my).toBeCloseTo((arc.p0[1] + arc.p3[1]) / 2, 0);
  });

  // Quebra se: as posições não avançarem ao longo do arco, ou avançarem aos saltos (um nó pularia uma "decisão").
  it('avança sem saltos: a distância entre pontos vizinhos é parecida', () => {
    const points = Array.from({ length: 21 }, (_, index) => pointOnArc(arc, index / 20));
    const steps = points.slice(1).map(([x, y], index) => Math.hypot(x - (points[index] as [number, number])[0], y - (points[index] as [number, number])[1]));
    const mean = steps.reduce((sum, step) => sum + step, 0) / steps.length;

    for (const step of steps) expect(Math.abs(step - mean) / mean).toBeLessThan(0.05);
  });

  // Quebra se: o t de fora do intervalo escapar do arco.
  it('corta t fora de 0..1 nas pontas', () => {
    expect(pointOnArc(arc, -1)).toEqual(pointOnArc(arc, 0));
    expect(pointOnArc(arc, 2)).toEqual(pointOnArc(arc, 1));
  });
});
