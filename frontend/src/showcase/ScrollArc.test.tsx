import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ARC_H, pointOnArc, scaleArc } from './arcGeometry';
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
  // Quebra se: a orientação voltar a depender da largura da JANELA. Um tablet em pé tem 768 px e uma caixa quase quadrada: o
  // arco horizontal, ali, é alto e estreito e o texto dos nós o atravessa. Quem decide é a proporção da caixa medida.
  it('auto escolhe o arco pela proporção da caixa: larga e baixa, horizontal; alta e estreita, vertical', () => {
    measuredBox(1340, 540);
    const wide = render(<ScrollArc orientation="auto" />);
    expect(arcs(wide.container).map((svg) => svg.getAttribute('data-arc'))).toEqual(['h']);
    expect(wide.container.firstElementChild).toHaveAttribute('data-orientation', 'horizontal');
    wide.unmount();

    measuredBox(672, 700); // tablet em pé
    const square = render(<ScrollArc orientation="auto" />);
    expect(arcs(square.container).map((svg) => svg.getAttribute('data-arc'))).toEqual(['v']);
    expect(square.container.firstElementChild).toHaveAttribute('data-orientation', 'vertical');
    square.unmount();

    measuredBox(358, 600); // celular
    const tall = render(<ScrollArc orientation="auto" />);
    expect(arcs(tall.container).map((svg) => svg.getAttribute('data-arc'))).toEqual(['v']);
    tall.unmount();

    // O limite (proporção 1,25): logo abaixo dele a caixa ainda é "em pé"; logo acima, já é larga.
    measuredBox(600, 500); // 1,2
    const almost = render(<ScrollArc orientation="auto" />);
    expect(almost.container.firstElementChild).toHaveAttribute('data-orientation', 'vertical');
    almost.unmount();

    measuredBox(650, 500); // 1,3
    const barely = render(<ScrollArc orientation="auto" />);
    expect(barely.container.firstElementChild).toHaveAttribute('data-orientation', 'horizontal');
  });

  // Quebra se: antes de medir (a primeira renderização) o arco não tiver uma orientação (a medida chega antes da pintura).
  it('auto, sem medida, começa horizontal', () => {
    const { container } = render(<ScrollArc orientation="auto" />);

    expect(arcs(container).map((svg) => svg.getAttribute('data-arc'))).toEqual(['h']);
  });

  // Quebra se: o desenho virar ruído para leitor de tela (o que ele diz o resto da cena já diz).
  it('o desenho é decorativo e não é esticado por viewBox', () => {
    const { container } = render(<ScrollArc orientation="horizontal" />);

    const svg = container.querySelector('svg') as SVGElement;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('preserveAspectRatio', 'none');
  });

  it('horizontal e vertical explícitos desenham só o seu', () => {
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

    // Quebra se: a posição de um nó sair do arco que está desenhado (o texto ficaria fora do caminho), ou não avançar com ele.
    it('cada nó guarda a posição no arco ativo, em porcentagem da caixa, avançando ao longo dele', () => {
      const along = (orientation: 'horizontal' | 'vertical', axis: '--x' | '--y') => {
        const { container, unmount } = render(<ScrollArc orientation={orientation} nodes={4} />);
        const values = Array.from(container.querySelectorAll('ol > li')).flatMap((item) => [nodeStyle(item, '--x'), nodeStyle(item, '--y')]);
        const track = Array.from(container.querySelectorAll('ol > li')).map((item) => nodeStyle(item, axis));
        unmount();
        return { values, track };
      };

      const horizontal = along('horizontal', '--x');
      const vertical = along('vertical', '--y');

      expect(horizontal.track).toEqual([...horizontal.track].sort((a, b) => a - b));
      expect(vertical.track).toEqual([...vertical.track].sort((a, b) => a - b));
      expect(new Set(horizontal.track).size).toBe(4);
      for (const value of [...horizontal.values, ...vertical.values]) {
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThan(100);
      }
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

  describe('pontas', () => {
    // Quebra se: as pontas não ficarem nas pontas do arco (a partida e a chegada são o arco: sem elas é só uma linha).
    it('ends marca a partida e a chegada, nas pontas dos dois arcos', () => {
      const { container } = render(<ScrollArc orientation="horizontal" ends />);
      const origin = container.querySelector('[data-end="origin"]') as HTMLElement;
      const target = container.querySelector('[data-end="target"]') as HTMLElement;
      expect(nodeStyle(origin, '--x')).toBeCloseTo(0, 1);
      expect(nodeStyle(target, '--x')).toBeCloseTo(100, 1);
      expect(origin).toHaveAttribute('aria-hidden', 'true');
      expect(target).toHaveAttribute('aria-hidden', 'true');

      const vertical = render(<ScrollArc orientation="vertical" ends />).container;
      expect(nodeStyle(vertical.querySelector('[data-end="origin"]') as Element, '--y')).toBeCloseTo(0, 1);
      expect(nodeStyle(vertical.querySelector('[data-end="target"]') as Element, '--y')).toBeCloseTo(100, 1);
    });

    it('sem ends, não há pontas', () => {
      const { container } = render(<ScrollArc orientation="auto" />);

      expect(container.querySelector('[data-end]')).toBeNull();
    });

    // Quebra se: os nomes das pontas (Marina e Rafael) forem para a ponta errada.
    it('com [de, para], nomeia a partida e a chegada', () => {
      const { container } = render(<ScrollArc orientation="horizontal" ends={['Marina', 'Rafael']} />);

      expect(container.querySelector('[data-end="origin"]')).toHaveTextContent('Marina');
      expect(container.querySelector('[data-end="target"]')).toHaveTextContent('Rafael');
    });
  });

  describe('desenho por tempo', () => {
    // Quebra se: a abertura continuar dependendo do scroll (ela se desenha sozinha, uma vez, ao carregar) ou as demais cenas
    // passarem a se desenhar sozinhas.
    it('timed marca o arco para o CSS desenhá-lo por tempo; sem timed, não', () => {
      expect(render(<ScrollArc timed />).container.querySelector('[data-timed]')).not.toBeNull();
      expect(render(<ScrollArc />).container.querySelector('[data-timed]')).toBeNull();
    });
  });

  // Quebra se: o texto do nó cair em cima do arco: nos flancos o texto vai para DENTRO do arco (onde há espaço), e só no
  // meio, onde o arco é quase plano, fica logo abaixo do nó.
  it('cada nó diz de que lado fica o seu texto: início, meio ou fim do arco', () => {
    const { container } = render(<ScrollArc orientation="auto" nodes={4} />);

    const sides = Array.from(container.querySelectorAll('ol > li')).map((item) => item.getAttribute('data-side'));
    expect(sides).toEqual(['start', 'middle', 'middle', 'end']);
  });

  describe('caixa medida', () => {
    // Quebra se: o arco voltar a ser uma forma esticada por viewBox (espessura deformada, comprimento falso): o caminho tem
    // de estar nos pixels da caixa que a cena deu.
    it('o viewBox e o caminho acompanham a caixa medida, em pixels', () => {
      measuredBox(1000, 200);

      const { container } = render(<ScrollArc orientation="auto" />);

      expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 1000 200');
      // 0,95 · 200 = 190; −0,1 · 200 = −20; 0,25 · 1000 = 250; 0,75 · 1000 = 750
      expect(container.querySelector('svg[data-arc="h"] path')?.getAttribute('d')).toBe('M0 190 C250 -20, 750 -20, 1000 190');
    });

    // Quebra se: os nós forem posicionados pelo parâmetro da curva ou na forma, e não no comprimento do arco medido: o
    // nó acenderia antes ou depois de a luz chegar. O arco é simétrico, então o do meio fica a 50% em qualquer caixa;
    // os outros dependem da proporção da caixa.
    it('os nós seguem o comprimento do arco medido: o do meio a 50%, os outros conforme a caixa', () => {
      const firstNodeX = (width: number, height: number) => {
        measuredBox(width, height);
        const { container, unmount } = render(<ScrollArc orientation="horizontal" nodes={3} />);
        const items = Array.from(container.querySelectorAll('ol > li'));
        const values = { first: nodeStyle(items[0] as Element, '--x'), middle: nodeStyle(items[1] as Element, '--x') };
        unmount();
        return values;
      };

      const wide = firstNodeX(1366, 300);
      const square = firstNodeX(768, 640);

      expect(wide.middle).toBeCloseTo(50, 0);
      expect(square.middle).toBeCloseTo(50, 0);
      expect(wide.first).not.toBeCloseTo(square.first, 0);
    });

    // Quebra se: a posição de um nó perder precisão (arredondada a inteiros de porcentagem, ele sairia até meio por cento do
    // traço: uns 5 px numa caixa de 1000 px). É a posição exata do ponto do arco, com três casas.
    it('a posição de cada nó é a do ponto do arco medido, com três casas', () => {
      measuredBox(1000, 200);
      const { container } = render(<ScrollArc orientation="horizontal" nodes={3} />);

      const arc = scaleArc(ARC_H, 1000, 200);
      Array.from(container.querySelectorAll('ol > li')).forEach((item, index) => {
        const [x, y] = pointOnArc(arc, (index + 1) / 4);
        expect(nodeStyle(item, '--x'), `x do nó ${index + 1}`).toBeCloseTo((x / 1000) * 100, 3);
        expect(nodeStyle(item, '--y'), `y do nó ${index + 1}`).toBeCloseTo((y / 200) * 100, 3);
      });
    });
  });
});
