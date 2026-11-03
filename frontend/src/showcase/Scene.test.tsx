import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Scene } from './Scene';

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
