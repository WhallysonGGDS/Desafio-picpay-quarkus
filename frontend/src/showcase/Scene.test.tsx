import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SCENE_PROGRESS_EVENT } from './motion';
import { Scene, useSceneProgress } from './Scene';

function Probe({ name }: { name: string }) {
  return <output data-testid={name}>{useSceneProgress()}</output>;
}

/** O que o motor faz a cada passo do scroll: escreve o atributo e avisa a cena. */
function move(section: Element, progress: string) {
  (section as HTMLElement).dataset['progress'] = progress;
  section.dispatchEvent(new Event(SCENE_PROGRESS_EVENT));
}

describe('Scene', () => {
  // Quebra se: a cena perder o id (o motor e os testes a encontram por [data-scene]) ou nascer com progresso diferente de zero
  // (a cena apareceria "já andada" antes de o ScrollTrigger assumir).
  it('é uma section com o id da cena e o progresso zerado', () => {
    const { container } = render(
      <Scene id={3}>
        <p>conteúdo</p>
      </Scene>,
    );

    const section = container.querySelector('section');
    expect(section).toHaveAttribute('data-scene', '3');
    expect(section).toHaveAttribute('data-progress', '0.000');
    expect(section?.style.getPropertyValue('--p')).toBe('0');
    expect(section).toHaveTextContent('conteúdo');
  });

  // Quebra se: toda cena virar fixada (o motor lê data-pinned para decidir quais prender).
  it('só leva data-pinned quando é fixada', () => {
    const { container } = render(
      <>
        <Scene id={1}>
          <p>a</p>
        </Scene>
        <Scene id={2} pinned>
          <p>b</p>
        </Scene>
      </>,
    );

    const [first, second] = Array.from(container.querySelectorAll('section'));
    expect(first).not.toHaveAttribute('data-pinned');
    expect(second).toHaveAttribute('data-pinned');
  });
});

describe('useSceneProgress', () => {
  // Quebra se: o texto que depende do scroll (o saldo da cena 3) não receber o progresso, ou não acompanhar quando ele muda.
  it('devolve o progresso da cena e acompanha as mudanças', () => {
    const { container } = render(
      <Scene id={3}>
        <Probe name="p" />
      </Scene>,
    );
    expect(screen.getByTestId('p')).toHaveTextContent('0');

    act(() => move(container.querySelector('section') as Element, '0.420'));

    expect(screen.getByTestId('p')).toHaveTextContent('0.42');
  });

  // Quebra se: o progresso de uma cena vazar para o texto de outra (o saldo andaria com o scroll da cena errada).
  it('cada cena tem o seu: o que acontece numa não mexe na outra', () => {
    const { container } = render(
      <>
        <Scene id={2}>
          <Probe name="two" />
        </Scene>
        <Scene id={3}>
          <Probe name="three" />
        </Scene>
      </>,
    );

    act(() => move(container.querySelector('[data-scene="3"]') as Element, '0.900'));

    expect(screen.getByTestId('two')).toHaveTextContent('0');
    expect(screen.getByTestId('three')).toHaveTextContent('0.9');
  });

  // Quebra se: um componente fora de qualquer cena (a vitrine montada em outro lugar) quebrar em vez de ficar parado em 0.
  it('fora de uma cena fica em 0', () => {
    render(<Probe name="loose" />);

    expect(screen.getByTestId('loose')).toHaveTextContent('0');
  });

  // Quebra se: o ouvinte ficar na cena depois que o texto sai (vaza a cada troca de rota), ou se refizer a cada passo do scroll
  // (a assinatura teria de ser estável: o React a refaria a cada render).
  it('liga um ouvinte só, não o refaz a cada passo e o solta ao sair', () => {
    const add = vi.spyOn(EventTarget.prototype, 'addEventListener');
    const remove = vi.spyOn(EventTarget.prototype, 'removeEventListener');
    const listeners = (spy: typeof add) =>
      spy.mock.calls.filter(([type]) => type === SCENE_PROGRESS_EVENT).map(([, listener]) => listener);
    try {
      const { container, unmount } = render(
        <Scene id={3}>
          <Probe name="p" />
        </Scene>,
      );
      const added = listeners(add);
      expect(added).toHaveLength(1);
      expect(listeners(remove)).toHaveLength(0);

      act(() => move(container.querySelector('section') as Element, '0.500'));
      act(() => move(container.querySelector('section') as Element, '0.600'));
      expect(screen.getByTestId('p')).toHaveTextContent('0.6');
      expect(listeners(add)).toHaveLength(1);
      expect(listeners(remove)).toHaveLength(0);

      unmount();
      const removed = listeners(remove);
      expect(removed).toHaveLength(1);
      expect(removed[0]).toBe(added[0]);
    } finally {
      add.mockRestore();
      remove.mockRestore();
    }
  });
});
