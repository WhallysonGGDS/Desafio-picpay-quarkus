/**
 * "2026-11-02T02:30:00Z" → "01/11/2026 23:30", no fuso do navegador (ou no informado).
 * O back-end manda UTC; mostrar o horário como veio poria a transferência das 23h30 no dia seguinte.
 * Montado por formatToParts para não depender do separador que o ICU escolhe entre data e hora.
 * Data inválida vira "—": um timestamp ruim não pode derrubar a tela do extrato.
 */
export function formatDateTime(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}`;
}
