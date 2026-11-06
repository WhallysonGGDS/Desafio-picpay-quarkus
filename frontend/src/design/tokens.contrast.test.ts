import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Lê o CSS de verdade: se alguém mexer num token, é o valor novo que é medido.
// (Caminho por node:path: o Vite reescreve `new URL('./x', import.meta.url)` para uma URL de servidor no jsdom.)
function readTokens(): Record<string, string> {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'tokens.css'), 'utf8');
  const tokens: Record<string, string> = {};
  for (const [, name, value] of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[name as string] = (value as string).trim();
  }
  return tokens;
}

// Contraste WCAG 2.x entre duas cores #RRGGBB, pela fórmula da especificação (independente do código sob teste).
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

describe('medidor de contraste', () => {
  // Valores publicados: preto sobre branco é 21:1 e #777777 sobre branco fica em 4,48:1 (reprova o AA por pouco).
  it('bate com os valores de referência da WCAG', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
  });
});

describe('tokens de cor', () => {
  const tokens = readTokens();

  // Quebra se: um token de texto, acento ou erro for clareado/escurecido até perder o AA em texto normal (4,5:1)
  // sobre o fundo ou sobre a superfície onde ele de fato aparece.
  it.each(['--text', '--text-2', '--text-3', '--accent', '--danger'])(
    '%s tem contraste AA (>= 4,5) sobre o fundo e sobre a superfície',
    (name) => {
      const color = tokens[name] as string;
      expect(color, `${name} precisa ser #RRGGBB`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(contrast(color, tokens['--bg'] as string), `${name} sobre --bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color, tokens['--surface'] as string), `${name} sobre --surface`).toBeGreaterThanOrEqual(4.5);
    },
  );
});
