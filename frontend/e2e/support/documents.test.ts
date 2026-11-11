import { describe, expect, it } from 'vitest';
import { isValidCnpj, isValidCpf } from '../../src/lib/document';
import { alphanumericCnpjFrom, cnpjFrom, cpfFrom } from './documents';

// Os testes ponta a ponta cadastram contas novas pela API, e o back-end só aceita CPF/CNPJ válidos. O gerador é conferido
// contra os mesmos validadores que o app usa (que por sua vez batem com os do back-end).
describe('cpfFrom', () => {
  // Quebra se: um dígito verificador sair errado: o cadastro do teste seria recusado com INVALID_DOCUMENT.
  it('gera CPFs válidos de 11 dígitos', () => {
    for (let seed = 0; seed < 3000; seed += 1) {
      const cpf = cpfFrom(seed);
      expect(cpf, `semente ${seed}`).toMatch(/^\d{11}$/);
      expect(isValidCpf(cpf), `${cpf} (semente ${seed})`).toBe(true);
    }
  });

  // Quebra se: duas sementes derem o mesmo CPF: o segundo cadastro seria recusado com DUPLICATE_DOCUMENT.
  it('sementes diferentes dão CPFs diferentes', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 5000; seed += 1) seen.add(cpfFrom(seed));
    expect(seen.size).toBe(5000);
  });

  // Quebra se: uma semente de dígitos todos iguais (111111110, 0...) gerar "111.111.111-11": é inválido por regra.
  it('nunca gera sequência de dígitos repetidos', () => {
    for (const seed of [0, 111111110, 222222221, 999999999, 1_000_000_000]) {
      const cpf = cpfFrom(seed);
      expect(new Set(cpf).size, `semente ${seed}`).toBeGreaterThan(1);
      expect(isValidCpf(cpf), `semente ${seed}`).toBe(true);
    }
  });
});

describe('cnpjFrom', () => {
  it('gera CNPJs válidos de 14 dígitos', () => {
    for (let seed = 0; seed < 3000; seed += 1) {
      const cnpj = cnpjFrom(seed);
      expect(cnpj, `semente ${seed}`).toMatch(/^\d{14}$/);
      expect(isValidCnpj(cnpj), `${cnpj} (semente ${seed})`).toBe(true);
    }
  });

  it('sementes diferentes dão CNPJs diferentes', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 5000; seed += 1) seen.add(cnpjFrom(seed));
    expect(seen.size).toBe(5000);
  });

  it('nunca gera sequência de dígitos repetidos', () => {
    for (const seed of [0, 11111111, 99999999]) {
      const cnpj = cnpjFrom(seed);
      expect(new Set(cnpj).size, `semente ${seed}`).toBeGreaterThan(1);
      expect(isValidCnpj(cnpj), `semente ${seed}`).toBe(true);
    }
  });
});

describe('alphanumericCnpjFrom', () => {
  // Quebra se: um dígito verificador sair errado (o valor da letra é o código ASCII menos 48): o cadastro do teste seria recusado.
  it('gera CNPJs alfanuméricos válidos de 14 caracteres', () => {
    for (let seed = 0; seed < 3000; seed += 1) {
      const cnpj = alphanumericCnpjFrom(seed);
      expect(cnpj, `semente ${seed}`).toMatch(/^[0-9A-Z]{12}\d{2}$/);
      expect(isValidCnpj(cnpj), `${cnpj} (semente ${seed})`).toBe(true);
    }
  });

  // Quebra se: o "alfanumérico" não tiver letra nenhuma: o teste passaria a provar só o CNPJ numérico de sempre.
  it('sempre tem letras na raiz', () => {
    for (const seed of [0, 1, 35, 36, 90_000_000, 90_000_000 + 3000]) {
      expect(alphanumericCnpjFrom(seed).slice(0, 8), `semente ${seed}`).toMatch(/[A-Z]/);
    }
  });

  // Quebra se: duas sementes derem o mesmo CNPJ: o segundo cadastro seria recusado com DUPLICATE_DOCUMENT.
  it('sementes diferentes dão CNPJs diferentes', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 5000; seed += 1) seen.add(alphanumericCnpjFrom(seed));
    expect(seen.size).toBe(5000);
  });
});
