/** O aviso que o motor dá, na própria cena, quando o progresso dela muda: é como o texto que depende do scroll (o saldo) o recebe. */
export const SCENE_PROGRESS_EVENT = 'sceneprogress';

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

/** Onde `value` está dentro da janela [from, to]: 0 antes dela, 1 depois, linear entre as duas. Janela sem largura é um degrau. */
export function windowed(value: number, from: number, to: number): number {
  if (to <= from) return value >= to ? 1 : 0;
  return clamp01((value - from) / (to - from));
}

/**
 * Interpola entre dois valores em centavos (bigint) sem passar por número de ponto flutuante: `t` vira milésimos
 * inteiros (o progresso das cenas já tem três casas) e a conta é de inteiros. O resultado fica entre os dois extremos.
 */
export function interpolateCents(from: bigint, to: bigint, t: number): bigint {
  const thousandths = BigInt(Math.round(clamp01(t) * 1000));
  return from + ((to - from) * thousandths) / 1000n;
}
