import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useElementSize } from './useElementSize';

// O jsdom não faz layout: quem mede (getBoundingClientRect) e quem avisa (ResizeObserver) entra como dublê.
let box = { width: 640, height: 320 };
let notify: (() => void) | undefined;
const observers: { observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];

class FakeResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(callback: () => void) {
    notify = callback;
    observers.push(this);
  }
}

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  const size = useElementSize(ref);
  return (
    <div ref={ref} data-testid="box">
      {size ? `${size.width}x${size.height}` : 'sem medida'}
    </div>
  );
}

beforeEach(() => {
  box = { width: 640, height: 320 };
  notify = undefined;
  observers.length = 0;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ ...box, top: 0, left: 0, right: box.width, bottom: box.height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useElementSize', () => {
  // Quebra se: a primeira medida esperar o observador (o arco apareceria um quadro com o tamanho errado antes de acertar).
  it('mede o elemento já na montagem', () => {
    render(<Probe />);

    expect(screen.getByTestId('box')).toHaveTextContent('640x320');
  });

  // Quebra se: redimensionar a janela (ou cruzar o ponto de quebra, em que a cena troca o tamanho do arco) não refizer a medida.
  it('mede de novo quando o elemento muda de tamanho', () => {
    render(<Probe />);

    box = { width: 358, height: 700 };
    act(() => notify?.());

    expect(screen.getByTestId('box')).toHaveTextContent('358x700');
  });

  // Quebra se: sair da tela deixar o observador ligado (vazamento, e medida de elemento que já não existe).
  it('desliga o observador ao desmontar', () => {
    const { unmount } = render(<Probe />);
    expect(observers[0]?.observe).toHaveBeenCalledTimes(1);

    unmount();

    expect(observers[0]?.disconnect).toHaveBeenCalledTimes(1);
  });

  // Quebra se: um navegador sem ResizeObserver derrubar a vitrine em vez de ficar só com a medida da montagem.
  it('sem ResizeObserver, fica com a medida da montagem', () => {
    vi.stubGlobal('ResizeObserver', undefined);

    render(<Probe />);

    expect(screen.getByTestId('box')).toHaveTextContent('640x320');
  });
});
