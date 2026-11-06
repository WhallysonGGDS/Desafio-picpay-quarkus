import { describe, expect, it } from 'vitest';
import { formatDateTime } from './format';

// O fuso do processo é America/Sao_Paulo (src/test/global-setup.ts), independente da máquina de quem roda.
describe('formatDateTime (RF4)', () => {
  // Quebra se: o horário UTC do back-end for mostrado como está, sem passar para o fuso de quem olha.
  // 02h30 UTC do dia 2 é 23h30 do dia 1º em São Paulo: errar aqui põe a transferência no dia errado do extrato.
  it('converte o horário UTC para o fuso local, inclusive na virada de dia', () => {
    expect(formatDateTime('2026-11-02T02:30:00Z')).toBe('01/11/2026 23:30');
  });

  it('aceita um fuso explícito', () => {
    expect(formatDateTime('2026-11-02T02:30:00Z', 'Asia/Tokyo')).toBe('02/11/2026 11:30');
    expect(formatDateTime('2026-11-02T02:30:00Z', 'UTC')).toBe('02/11/2026 02:30');
  });

  // Quebra se: meia-noite sair como "24:00" (hour12:false de alguns motores) ou sem zero à esquerda.
  it('usa 00:00 à meia-noite e dois dígitos em tudo', () => {
    expect(formatDateTime('2026-01-05T03:00:00Z')).toBe('05/01/2026 00:00');
    expect(formatDateTime('2026-03-09T12:07:00Z')).toBe('09/03/2026 09:07');
  });

  // Quebra se: um timestamp inválido derrubar a tela inteira do extrato em vez de mostrar um traço.
  it('devolve um traço para data inválida, sem lançar', () => {
    expect(formatDateTime('não é data')).toBe('—');
    expect(formatDateTime('')).toBe('—');
  });
});
