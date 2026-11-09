import { ROUTES } from '../routes';

/**
 * O destino pedido pelo `?next=` do login, ou o padrão se ele não for um caminho da própria origem.
 * O `next` vem da URL, ou seja, de quem a montou: aceitar qualquer coisa seria um redirecionamento aberto
 * (a pessoa autentica e cai no site de outra pessoa).
 *
 * Só vale o que começa com UMA barra. "//host" é URL relativa ao protocolo e leva a outro site; "\" é tratado como
 * "/" pelos navegadores; e tab, quebra de linha e outros caracteres de controle são removidos ao interpretar a URL
 * ("/\t/evil.com" viraria "//evil.com"). Texto sem barra inicial (esquema, " /x", "carteira") também é recusado.
 */
export function safeNext(raw: string | null | undefined, fallback: string = ROUTES.wallet): string {
  if (typeof raw !== 'string') return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (raw.includes('\\') || /[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  return raw;
}
