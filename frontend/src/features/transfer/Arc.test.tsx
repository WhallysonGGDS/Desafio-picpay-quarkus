import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Arc, type ArcState } from './Arc';

describe('Arc', () => {
  // Quebra se: o estado deixar de chegar ao CSS (data-arc-state é o que o liga à animação) ou de ser anunciado:
  // quem usa leitor de tela precisa saber que está autorizando, que enviou, ou que não enviou.
  it.each([
    ['idle', 'Pronto para enviar'],
    ['authorizing', 'Autorizando…'],
    ['landed', 'Enviado'],
    ['retracted', 'Não enviado'],
  ] as [ArcState, string][])('estado %s expõe data-arc-state e anuncia "%s"', (state, announcement) => {
    const { container } = render(<Arc state={state} from="Você" to="Rafael" />);

    expect(container.firstElementChild).toHaveAttribute('data-arc-state', state);
    expect(screen.getByRole('status')).toHaveTextContent(announcement);
    expect(screen.getByRole('status')).toHaveClass('sr-only');
  });

  it('mostra os nomes das duas pontas', () => {
    render(<Arc state="idle" from="Você" to="Rafael" />);

    expect(screen.getByText('Você')).toBeInTheDocument();
    expect(screen.getByText('Rafael')).toBeInTheDocument();
  });

  // Quebra se: o desenho virar ruído para o leitor de tela (a informação já está no status) ou o traço de luz
  // perder o pathLength=1, de que o CSS depende para desenhá-lo por proporção (dasharray 1).
  it('o desenho é decorativo e o traço de luz mede 1', () => {
    const { container } = render(<Arc state="landed" from="Você" to="Rafael" />);

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    const light = container.querySelector('path[pathLength="1"]');
    expect(light).not.toBeNull();
  });
});

// O jsdom não anima nem calcula animação: o que o movimento faz na tela só se confere no navegador. Estes dois
// invariantes, que já falharam uma vez numa captura de verdade, se travam lendo o CSS-fonte (como tokens.usage.test).
// Caminho por node:path: o Vite reescreve `new URL(..., import.meta.url)` no jsdom.
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Arc.module.css'), 'utf8');

describe('Arc.module.css (movimento)', () => {
  // Quebra se: uma animação com atraso voltar a usar fill-mode `both`/`backwards`. Nesse modo o primeiro quadro vale
  // já durante a espera: o anel de chegada (opacidade 0,9 no primeiro quadro) aparecia em ciano 640 ms antes de o
  // arco chegar, dizendo "enviado" antes da hora.
  it('animação com atraso não aplica o primeiro quadro durante a espera', () => {
    const delayed: string[] = [];
    for (const [, value] of css.matchAll(/animation:\s*([^;]+);/g)) {
      // nome duração easing [atraso] [preenchimento] [iteração]
      const tokens = (value as string).match(/var\([^)]*\)|\S+/g) ?? [];
      if (/^(var\(--dur-\d\)|[\d.]+m?s)$/.test(tokens[3] ?? '')) delayed.push(value as string);
    }

    expect(delayed).toHaveLength(2); // o ponto de chegada e o anel: se o leitor não achar nenhum, o teste não prova nada
    for (const value of delayed) expect(value).not.toMatch(/\b(both|backwards)\b/);
  });

  // Quebra se: o recuo voltar a desenhar o arco em acento. Um arco ciano inteiro é a cara de "enviado": numa recusa
  // ele apareceria, por um instante, com o visual do sucesso.
  it('o recuo da recusa é em vermelho funcional, nunca no acento do envio', () => {
    const block = css.match(/\[data-arc-state='retracted'\]\s+\.light\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(block).toMatch(/stroke:\s*var\(--danger\)/);
  });
});
