/** O aviso que o motor dá, na própria cena, quando o progresso dela muda: é como o texto que depende do scroll (o saldo) o recebe. */
export const SCENE_PROGRESS_EVENT = 'sceneprogress';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Janela em que as cenas fixadas não cabem: o texto de uma passaria por cima do de outra. O motor não as prende (elas ficam em
 * fluxo, no estado final) e o CSS tira a altura fixa. São duas faixas:
 *
 * - até 62rem de largura (992 px) e 36rem de altura (576 px): o celular deitado e as janelas baixas, onde o palco não comporta
 *   nem o arco horizontal (as quatro decisões se tocam) nem o vertical (precisa de uma coluna alta);
 * - até 46rem de largura (736 px) e 48rem de altura (768 px), com a janela quadrada ou deitada (largura >= altura): com o palco
 *   de uns 650 px o arco horizontal deixa menos de 190 px entre os dois textos do meio, para uns 170 px de texto cada um.
 *   Quem está em pé (o celular, o tablet) fica de fora de propósito: o arco ali é vertical e cabe.
 *
 * O mesmo texto está no `@media` de showcase.module.css e no de scenes/Context.module.css; um teste confere que os três são
 * iguais.
 */
export const COMPACT_WINDOW_QUERY =
  '(max-width: 62rem) and (max-height: 36rem), (max-width: 46rem) and (max-height: 48rem) and (min-aspect-ratio: 1/1)';

function matches(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false;
}

/** A pessoa pediu menos movimento (prefers-reduced-motion: reduce). Sem matchMedia (jsdom, navegador antigo), não pediu. */
export function prefersReducedMotion(): boolean {
  return matches(REDUCED_MOTION_QUERY);
}

/** A janela é estreita e baixa demais para as cenas fixadas (veja COMPACT_WINDOW_QUERY). */
export function isCompactWindow(): boolean {
  return matches(COMPACT_WINDOW_QUERY);
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
