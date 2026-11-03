import { afterEach, describe, expect, it, vi } from 'vitest';
import { clamp01, formatProgress, interpolateCents, prefersReducedMotion, windowed } from './motion';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('prefersReducedMotion', () => {
  // Quebra se: a vitrine ler outro media query (ou ignorar a preferência): quem pediu menos movimento levaria pins e rolagem suave.
  it('lê o media query prefers-reduced-motion: reduce', () => {
    const matchMedia = vi.fn((query: string) => ({ matches: true, media: query }) as MediaQueryList);
    vi.stubGlobal('matchMedia', matchMedia);

    expect(prefersReducedMotion()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');

    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }) as MediaQueryList);
    expect(prefersReducedMotion()).toBe(false);
  });

  // Quebra se: um ambiente sem matchMedia (o jsdom, um navegador antigo) derrubar a página em vez de seguir como "sem preferência".
  it('sem matchMedia não pede menos movimento, e não lança', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('clamp01', () => {
  it('mantém o que já está entre 0 e 1 e corta o resto', () => {
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(7)).toBe(1);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(1)).toBe(1);
  });

  // Quebra se: um NaN (progresso de uma cena sem altura) escapar e virar "NaN" no CSS, que o navegador descarta em silêncio.
  it('NaN vira 0 e o infinito é cortado', () => {
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(1);
    expect(clamp01(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe('formatProgress', () => {
  // Quebra se: o progresso sair com outra precisão: o teste ponta a ponta compara "0.000" e o CSS não precisa de mais.
  it('escreve o progresso com três casas, cortado entre 0 e 1', () => {
    expect(formatProgress(0)).toBe('0.000');
    expect(formatProgress(0.12345)).toBe('0.123');
    expect(formatProgress(0.9996)).toBe('1.000');
    expect(formatProgress(1)).toBe('1.000');
    expect(formatProgress(-0.2)).toBe('0.000');
    expect(formatProgress(3)).toBe('1.000');
    expect(formatProgress(Number.NaN)).toBe('0.000');
  });
});

describe('windowed', () => {
  // Quebra se: a janela de uma animação (o saldo cai entre 55% e 90% da cena) começar cedo, terminar tarde ou não segurar as pontas.
  it('0 antes da janela, 1 depois, e linear dentro dela', () => {
    expect(windowed(0, 0.55, 0.9)).toBe(0);
    expect(windowed(0.55, 0.55, 0.9)).toBe(0);
    expect(windowed(0.725, 0.55, 0.9)).toBeCloseTo(0.5, 10);
    expect(windowed(0.9, 0.55, 0.9)).toBe(1);
    expect(windowed(1, 0.55, 0.9)).toBe(1);
  });

  // Quebra se: uma janela vazia dividir por zero e entregar NaN ao CSS.
  it('janela sem largura é um degrau, sem NaN', () => {
    expect(windowed(0.4, 0.5, 0.5)).toBe(0);
    expect(windowed(0.5, 0.5, 0.5)).toBe(1);
    expect(windowed(0.9, 0.5, 0.5)).toBe(1);
  });
});

describe('interpolateCents', () => {
  // Quebra se: as pontas do saldo da cena 3 não forem exatamente R$ 1.000,00 e R$ 750,00.
  it('t = 0 é o início e t = 1 é o fim, exatos', () => {
    expect(interpolateCents(100000n, 75000n, 0)).toBe(100000n);
    expect(interpolateCents(100000n, 75000n, 1)).toBe(75000n);
    expect(interpolateCents(100000n, 75000n, 0.5)).toBe(87500n);
  });

  // Quebra se: a conta passar por número de ponto flutuante (0,333 · 25000 deixaria um resíduo) em vez de milésimos inteiros.
  it('é inteira: t = 0,333 cai em R$ 916,75 exatos', () => {
    expect(interpolateCents(100000n, 75000n, 0.333)).toBe(91675n);
  });

  // Quebra se: o saldo voltar a subir enquanto o scroll avança (o teste ponta a ponta exige não crescente) ou sair do intervalo.
  it('é monotônica não crescente e fica entre os dois extremos, em cada milésimo', () => {
    let previous = interpolateCents(100000n, 75000n, 0);
    for (let thousandth = 1; thousandth <= 1000; thousandth += 1) {
      const value = interpolateCents(100000n, 75000n, thousandth / 1000);
      expect(value <= previous, `milésimo ${thousandth}`).toBe(true);
      expect(value >= 75000n && value <= 100000n).toBe(true);
      previous = value;
    }
  });

  // Quebra se: t fora de 0..1 (ou NaN) levar o saldo para fora do intervalo.
  it('corta t fora de 0..1 e trata NaN como 0', () => {
    expect(interpolateCents(100000n, 75000n, -1)).toBe(100000n);
    expect(interpolateCents(100000n, 75000n, 7)).toBe(75000n);
    expect(interpolateCents(100000n, 75000n, Number.NaN)).toBe(100000n);
  });

  it('também cresce, quando o fim é maior que o início', () => {
    expect(interpolateCents(0n, 1000n, 0.25)).toBe(250n);
  });

  // Quebra se: um t fora da grade dos milésimos for cortado para baixo (Math.floor) em vez de arredondado ao mais próximo.
  it('arredonda t ao milésimo mais próximo', () => {
    expect(interpolateCents(0n, 1000n, 0.0004)).toBe(0n);
    expect(interpolateCents(0n, 1000n, 0.0006)).toBe(1n);
    expect(interpolateCents(0n, 1000n, 0.9996)).toBe(1000n);
  });
});
