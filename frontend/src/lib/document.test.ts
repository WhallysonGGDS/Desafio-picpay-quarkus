import { describe, expect, it } from 'vitest';
import { digitsOnly, isValidCnpj, isValidCpf, maskDocumentInput } from './document';

// As mesmas fixtures do back-end (DocumentValidatorTest): o front e o servidor precisam concordar sobre o que é válido.
describe('isValidCpf', () => {
  // Quebra se: um dígito verificador for calculado errado e um CPF real for recusado.
  it.each(['52998224725', '11144477735'])('aceita %s', (cpf) => {
    expect(isValidCpf(cpf)).toBe(true);
  });

  // Quebra se: faltar um critério: dígito verificador errado, sequência repetida, tamanho, letra.
  it.each(['52998224724', '11111111111', '123', '', '529982247250', '5299822472a'])('recusa "%s"', (cpf) => {
    expect(isValidCpf(cpf)).toBe(false);
  });
});

describe('isValidCnpj', () => {
  it('aceita um CNPJ válido', () => {
    expect(isValidCnpj('11222333000181')).toBe(true);
  });

  it.each(['11222333000182', '00000000000000', '1122233300018', ''])('recusa "%s"', (cnpj) => {
    expect(isValidCnpj(cnpj)).toBe(false);
  });
});

describe('maskDocumentInput', () => {
  // Quebra se: a máscara pontuar à frente de quem digita (ponto sobrando no fim) ou deixar passar dígito além do limite.
  it('aplica a máscara de CPF aos poucos e limita a 11 dígitos', () => {
    expect(maskDocumentInput('5299', 'COMMON')).toBe('529.9');
    expect(maskDocumentInput('529', 'COMMON')).toBe('529');
    expect(maskDocumentInput('529982247', 'COMMON')).toBe('529.982.247');
    expect(maskDocumentInput('5299822472', 'COMMON')).toBe('529.982.247-2');
    expect(maskDocumentInput('52998224725999', 'COMMON')).toBe('529.982.247-25');
  });

  it('aplica a máscara de CNPJ aos poucos e limita a 14 dígitos', () => {
    expect(maskDocumentInput('112', 'MERCHANT')).toBe('11.2');
    expect(maskDocumentInput('11222333', 'MERCHANT')).toBe('11.222.333');
    expect(maskDocumentInput('112223330001', 'MERCHANT')).toBe('11.222.333/0001');
    expect(maskDocumentInput('11222333000181999', 'MERCHANT')).toBe('11.222.333/0001-81');
  });

  // Quebra se: colar um documento já pontuado, ou com letras, passar a bagunçar o campo.
  it('reaproveita o que já está pontuado e ignora o que não é dígito', () => {
    expect(digitsOnly('529.982.247-25')).toBe('52998224725');
    expect(maskDocumentInput('529.982.247-25', 'COMMON')).toBe('529.982.247-25');
    expect(maskDocumentInput('a5b2c9', 'COMMON')).toBe('529');
    expect(maskDocumentInput('', 'COMMON')).toBe('');
  });
});
