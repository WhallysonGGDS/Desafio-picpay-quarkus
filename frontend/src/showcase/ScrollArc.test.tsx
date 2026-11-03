import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScrollArc } from './ScrollArc';

// O jsdom não faz layout: a caixa que a cena dá ao arco entra como dublê de getBoundingClientRect.
function measuredBox(width: number, height: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

const arcs = (container: HTMLElement) => Array.from(container.querySelectorAll('svg[data-arc]'));
const nodeStyle = (node: Element, name: string) => parseFloat((node as HTMLElement).style.getPropertyValue(name));

describe('ScrollArc', () => {
  // Quebra se: faltar um dos dois caminhos (o celular ficaria sem arco, ou a tela larga) ou o desenho virar ruído para leitor de tela.
  it('auto: desenha os dois caminhos, um para cada faixa de largura, e ambos são decorativos', () => {
    const { container } = render(<ScrollArc orientation="auto" />);

    expect(arcs(container).map((svg) => svg.getAttribute('data-arc'))).toEqual(['h', 'v']);
    for (const svg of arcs(container)) {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('preserveAspectRatio', 'none');
    }
  });

  it('horizontal desenha só o horizontal; vertical, só o vertical', () => {
    expect(arcs(render(<ScrollArc orientation="horizontal" />).container).map((s) => s.getAttribute('data-arc'))).toEqual(['h']);
    expect(arcs(render(<ScrollArc orientation="vertical" />).container).map((s) => s.getAttribute('data-arc'))).toEqual(['v']);
  });

  // Quebra se: o traço de luz perder o pathLength=1, de que o CSS depende para desenhá-lo por --p (dasharray e dashoffset
  // são proporções do arco), ou se o trilho e o traço deixarem de ser o mesmo caminho.
  it('o trilho e o traço de luz são o mesmo caminho, e o traço mede 1', () => {
    const { container } = render(<ScrollArc orientation="horizontal" />);

    const paths = Array.from(container.querySelectorAll('svg[data-arc="h"] path'));
    expect(paths.length).toBeGreaterThanOrEqual(2);
    expect(new Set(paths.map((path) => path.getAttribute('d'))).size).toBe(1);
    // todos medem 1: o traço de luz, a cabeça e o halo se desenham por proporção (dasharray e dashoffset em fração do arco)
    for (const path of paths) expect(path).toHaveAttribute('pathLength', '1');
    for (const path of paths) expect(path.getAttribute('d')).toMatch(/^M-?[\d.]+ -?[\d.]+ C/);
  });

  describe('nós', () => {
    // Quebra se: os nós não se espalharem por igual ao longo do arco (a luz acenderia um nó muito antes dos outros).
    it('com 4 nós, ficam a 20%, 40%, 60% e 80% do comprimento', () => {
      const { container } = render(<ScrollArc orientation="auto" nodes={4} />);

      const items = Array.from(container.querySelectorAll('ol > li'));
      expect(items).toHaveLength(4);
      expect(items.map((item) => nodeStyle(item, '--t'))).toEqual([0.2, 0.4, 0.6, 0.8]);
    });

    // Quebra se: as posições forem as de um arco só (o texto dos nós ficaria fora do caminho numa das duas orientações).
    it('cada nó guarda a posição nos dois arcos, em porcentagem da caixa, avançando ao longo deles', () => {
      const { container } = render(<ScrollArc orientation="auto" nodes={4} />);
      const items = Array.from(container.querySelectorAll('ol > li'));

      const xh = items.map((item) => nodeStyle(item, '--xh'));
      const yv = items.map((item) => nodeStyle(item, '--yv'));
      expect(xh).toEqual([...xh].sort((a, b) => a - b));
      expect(yv).toEqual([...yv].sort((a, b) => a - b));
      for (const value of [...xh, ...yv, ...items.map((i) => nodeStyle(i, '--yh')), ...items.map((i) => nodeStyle(i, '--xv'))]) {
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThan(100);
      }
      expect(new Set(xh).size).toBe(4);
    });

    // Quebra se: o texto de cada nó não for para dentro do nó certo, ou os rótulos não definirem a quantidade de nós.
    it('os rótulos viram os nós, na ordem', () => {
      const { container } = render(<ScrollArc orientation="auto" labels={['Primeiro', 'Segundo', 'Terceiro']} />);

      const items = Array.from(container.querySelectorAll('ol > li'));
      expect(items.map((item) => item.textContent)).toEqual(['Primeiro', 'Segundo', 'Terceiro']);
      expect(items.map((item) => nodeStyle(item, '--t'))).toEqual([0.25, 0.5, 0.75]);
    });

    it('sem nós, não desenha a lista', () => {
      const { container } = render(<ScrollArc orientation="auto" />);

      expect(container.querySelector('ol')).toBeNull();
    });
  });

  describe('caixa medida', () => {
    // Quebra se: o arco voltar a ser uma forma esticada por viewBox (espessura deformada, comprimento falso): o caminho tem
    // de estar nos pixels da caixa que a cena deu.
    it('o viewBox e o caminho acompanham a caixa medida, em pixels', () => {
      measuredBox(1000, 200);

      const { container } = render(<ScrollArc orientation="auto" />);

      for (const svg of arcs(container)) expect(svg).toHaveAttribute('viewBox', '0 0 1000 200');
      // 0,95 · 200 = 190; −0,1 · 200 = −20; 0,25 · 1000 = 250; 0,75 · 1000 = 750
      expect(container.querySelector('svg[data-arc="h"] path')?.getAttribute('d')).toBe('M0 190 C250 -20, 750 -20, 1000 190');
    });

    // Quebra se: os nós forem posicionados pelo parâmetro da curva ou na forma, e não no comprimento do arco medido: o
    // nó acenderia antes ou depois de a luz chegar. O arco é simétrico, então o do meio fica a 50% em qualquer caixa;
    // os outros dependem da proporção da caixa.
    it('os nós seguem o comprimento do arco medido: o do meio a 50%, os outros conforme a caixa', () => {
      const firstNodeX = (width: number, height: number) => {
        measuredBox(width, height);
        const { container, unmount } = render(<ScrollArc orientation="auto" nodes={3} />);
        const items = Array.from(container.querySelectorAll('ol > li'));
        const values = { first: nodeStyle(items[0] as Element, '--xh'), middle: nodeStyle(items[1] as Element, '--xh') };
        unmount();
        return values;
      };

      const wide = firstNodeX(1366, 300);
      const square = firstNodeX(768, 640);

      expect(wide.middle).toBeCloseTo(50, 0);
      expect(square.middle).toBeCloseTo(50, 0);
      expect(wide.first).not.toBeCloseTo(square.first, 0);
    });
  });
});
