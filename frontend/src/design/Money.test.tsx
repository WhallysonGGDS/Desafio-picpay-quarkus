import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Money } from './Money';

const separators = (container: HTMLElement) => Array.from(container.querySelectorAll('[data-separator]')).map((element) => element.textContent);

describe('Money no tamanho de exibição', () => {
  // Quebra se: o separador deixar de ter o seu próprio elemento (o CSS não teria onde aproximá-lo e a vírgula ficaria solta
  // numa célula inteira da fonte mono: "750 ,00"), ou se o texto mudar: o leitor de tela, a cópia e a busca dependem dele.
  it('põe cada ponto e vírgula do número no seu span, e o texto continua "R$ 1.000,00"', () => {
    const { container } = render(<Money value="1000.00" variant="display" />);

    expect(separators(container)).toEqual(['.', ',']);
    expect(container.textContent).toBe('R$ 1.000,00');
    // E o span leva a classe que o CSS aproxima dos algarismos (sem ela a margem negativa nunca vale).
    for (const element of Array.from(container.querySelectorAll('[data-separator]'))) expect(element.className).toMatch(/separator/);
  });

  it('um saldo sem milhar tem só a vírgula', () => {
    const { container } = render(<Money value={75000n} variant="display" />);

    expect(separators(container)).toEqual([',']);
    expect(container.textContent).toBe('R$ 750,00');
  });

  it('o sinal e o R$ não viram separador', () => {
    const { container } = render(<Money value={25000n} variant="display" sign="−" />);

    expect(separators(container)).toEqual([',']);
    expect(container.textContent).toBe('−R$ 250,00');
  });

  // Quebra se: as colunas (o extrato, o resumo do envio) ganharem o tratamento: lá cada sinal tem a sua célula para o alinhamento.
  it('as outras variantes não mudam: sem spans de separador', () => {
    for (const variant of ['row', 'inline'] as const) {
      const { container, unmount } = render(<Money value="1234.56" variant={variant} />);

      expect(separators(container), variant).toEqual([]);
      expect(container.textContent).toBe('R$ 1.234,56');
      unmount();
    }
  });
});

// O jsdom não aplica CSS: o que aproxima o separador dos algarismos só se garante lendo o CSS-fonte.
describe('Money.module.css (separador)', () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Money.module.css'), 'utf8');

  // Quebra se: a margem negativa sumir ou virar positiva (a vírgula voltaria a ficar solta) ou passar do ponto (a vírgula
  // encostaria no algarismo): entre -0,1em e -0,3em de cada lado.
  it('o separador recua em direção aos algarismos, de 0,1 a 0,3 em de cada lado', () => {
    const rule = /\.separator\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    const margin = /margin-inline:\s*(-[\d.]+)em/.exec(rule)?.[1];

    expect(margin, 'o .separator precisa de margin-inline negativo em em').toBeDefined();
    expect(Number(margin)).toBeLessThanOrEqual(-0.1);
    expect(Number(margin)).toBeGreaterThanOrEqual(-0.3);
  });
});
