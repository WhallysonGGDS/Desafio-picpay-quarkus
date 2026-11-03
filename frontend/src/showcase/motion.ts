/** A pessoa pediu menos movimento (prefers-reduced-motion: reduce). Sem matchMedia (jsdom, navegador antigo), não pediu. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/** Corta o valor entre 0 e 1. NaN vira 0: um progresso sem sentido não pode chegar ao CSS, que o descartaria em silêncio. */
export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** O progresso de uma cena como o CSS e o atributo data-progress o recebem: de "0.000" a "1.000". */
export function formatProgress(progress: number): string {
  return clamp01(progress).toFixed(3);
}
