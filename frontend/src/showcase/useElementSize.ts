import { useLayoutEffect, useState, type RefObject } from 'react';

export interface Size {
  width: number;
  height: number;
}

/**
 * O tamanho, em pixels, de um elemento: medido na montagem, antes da primeira pintura, e refeito quando ele muda. É o que
 * deixa o arco ser calculado na caixa que a cena lhe dá. `null` até o elemento existir.
 */
export function useElementSize(ref: RefObject<Element | null>): Size | null {
  const [size, setSize] = useState<Size | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setSize((current) => (current?.width === width && current.height === height ? current : { width, height }));
    };
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
