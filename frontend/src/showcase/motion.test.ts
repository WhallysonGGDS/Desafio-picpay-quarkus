import { afterEach, describe, expect, it, vi } from 'vitest';
import { clamp01, formatProgress, prefersReducedMotion } from './motion';

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
