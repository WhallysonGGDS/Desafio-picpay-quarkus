import { describe, expect, it } from 'vitest';
import { apiToCents, centsToApi, formatBRL, formatBRLFromApi, parseAmountInput } from './money';

// RF1: o que a pessoa digita em formato brasileiro vira os centavos exatos. Dinheiro é bigint, nunca float.
describe('parseAmountInput (RF1)', () => {
  // Quebra se: vírgula e ponto trocarem de papel (1.250,50 virar 1,25), ou "R$" e espaços atrapalharem.
  it.each([
    ['250', '25000'],
    ['250,5', '25050'],
    ['250,50', '25050'],
    ['0,5', '50'],
    ['0,01', '1'],
    ['1.250,50', '125050'],
    ['1250,50', '125050'],
    ['R$ 10,00', '1000'],
    ['12.5', '1250'],
    ['12.50', '1250'],
    ['1.000', '100000'],
    ['1.000.000', '100000000'],
    ['  7  ', '700'],
    ['999999999999999,99', '99999999999999999'],
  ])('aceita "%s" como %s centavos', (text, cents) => {
    expect(parseAmountInput(text)).toBe(BigInt(cents));
  });

  // Quebra se: um texto ambíguo ou inválido for interpretado em vez de recusado. Num app de dinheiro,
  // "1,234" virar R$ 1,23 ou "0.500" virar R$ 500 é pior do que pedir para a pessoa digitar de novo.
  it.each([
    '',
    'R$',
    '0',
    '0,00',
    '-5',
    '+5',
    '1,234',
    '0,001',
    '1.2.3',
    '12,5,0',
    'abc',
    '1.0000',
    '1.00.000,5',
    '1,',
    ',5',
    '.5',
    '1.',
    '1,000.50',
    '0.500',
    '٣',
    '9999999999999999',
  ])('recusa "%s"', (text) => {
    expect(parseAmountInput(text)).toBeNull();
  });

  // Quebra se: o que a tela mostra deixar de ser aceito de volta (copiar "1.250,50" do extrato e colar no campo).
  it('aceita de volta o que formatBRL mostra', () => {
    for (const cents of [1n, 99n, 100n, 100000n, 125050n, 100000000n, 99999999999999999n]) {
      expect(parseAmountInput(formatBRL(cents).replace('R$ ', ''))).toBe(cents);
    }
  });
});

describe('formatBRL', () => {
  // Quebra se: o milhar, a vírgula ou o "R$ " saírem diferentes do que o back-end e o extrato mostram.
  it('formata centavos em reais, com milhar e duas casas', () => {
    expect(formatBRL(125000n)).toBe('R$ 1.250,00');
    expect(formatBRL(5n)).toBe('R$ 0,05');
    expect(formatBRL(0n)).toBe('R$ 0,00');
    expect(formatBRL(99999999999999999n)).toBe('R$ 999.999.999.999.999,99');
    expect(formatBRL(-5n)).toBe('-R$ 0,05');
  });

  // Quebra se: o saldo vindo da API passar por número de ponto flutuante (1234567.89 perderia precisão em somas).
  it('formata a string da API sem arredondar', () => {
    expect(formatBRLFromApi('1234567.89')).toBe('R$ 1.234.567,89');
    expect(formatBRLFromApi('1000.00')).toBe('R$ 1.000,00');
  });
});

describe('apiToCents / centsToApi', () => {
  // Quebra se: a conversão do formato da API (string com ponto) para centavos errar a escala.
  it('converte a string da API em centavos', () => {
    expect(apiToCents('1250.00')).toBe(125000n);
    expect(apiToCents('0.05')).toBe(5n);
    expect(apiToCents('7')).toBe(700n);
    expect(apiToCents('-0.05')).toBe(-5n);
  });

  // Quebra se: um valor malformado passar em silêncio (vira NaN ou zero) em vez de acusar o erro.
  it.each(['', 'abc', '1.234', '1,50'])('recusa "%s"', (bad) => {
    expect(() => apiToCents(bad)).toThrow();
  });

  it('escreve centavos no formato que a API aceita', () => {
    expect(centsToApi(125000n)).toBe('1250.00');
    expect(centsToApi(5n)).toBe('0.05');
    expect(centsToApi(-5n)).toBe('-0.05');
  });

  // Quebra se: ida e volta perderem um centavo.
  it('ida e volta preservam os centavos', () => {
    for (const cents of [0n, 1n, 5n, 99n, 100n, 125050n, 99999999999999999n, -5n, -125050n]) {
      expect(apiToCents(centsToApi(cents))).toBe(cents);
    }
  });
});
