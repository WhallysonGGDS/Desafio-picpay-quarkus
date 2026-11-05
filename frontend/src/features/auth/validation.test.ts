import { describe, expect, it } from 'vitest';
import { validateLogin, validateRegister, type RegisterForm } from './validation';

const valid: RegisterForm = {
  userType: 'COMMON',
  firstName: 'Marina',
  lastName: 'Alves',
  email: 'marina@arco.demo',
  document: '529.982.247-25',
  password: 'demo1234',
};

// A validação do cliente só poupa uma ida ao servidor: o servidor continua sendo a autoridade.
describe('validateRegister', () => {
  it('um formulário válido não tem erro', () => {
    expect(validateRegister(valid)).toEqual({});
  });

  // Quebra se: um campo obrigatório passar vazio (ou só com espaços) e a ida ao servidor voltar com 400.
  it('campos vazios ou só com espaços são REQUIRED', () => {
    expect(validateRegister({ ...valid, firstName: '  ', lastName: '', email: ' ', document: '', password: '' })).toEqual({
      firstName: 'REQUIRED',
      lastName: 'REQUIRED',
      email: 'REQUIRED',
      document: 'REQUIRED',
      password: 'REQUIRED',
    });
  });

  it('nome e sobrenome têm no máximo 80 caracteres, e o e-mail 160', () => {
    expect(validateRegister({ ...valid, firstName: 'a'.repeat(81), lastName: 'b'.repeat(80) })).toEqual({ firstName: 'TOO_LONG' });
    expect(validateRegister({ ...valid, email: `${'a'.repeat(150)}@arco.demo` })).toEqual({}); // 160: no limite
    expect(validateRegister({ ...valid, email: `${'a'.repeat(151)}@arco.demo` })).toEqual({ email: 'TOO_LONG' }); // 161
  });

  // Quebra se: o e-mail sem arroba passar, ou um e-mail válido com espaços ao redor (colado) for recusado.
  it('e-mail precisa de uma arroba e não aceita espaços no meio; espaços nas pontas são aparados', () => {
    expect(validateRegister({ ...valid, email: 'marina.arco.demo' })).toEqual({ email: 'INVALID_EMAIL' });
    expect(validateRegister({ ...valid, email: 'mari na@arco.demo' })).toEqual({ email: 'INVALID_EMAIL' });
    expect(validateRegister({ ...valid, email: 'a@b@c' })).toEqual({ email: 'INVALID_EMAIL' });
    expect(validateRegister({ ...valid, email: '  marina@arco.demo  ' })).toEqual({});
  });

  // Quebra se: o dígito verificador do CPF/CNPJ deixar de ser conferido, ou o tipo errado valer (CPF para loja).
  it('o documento é conferido pelo tipo: CPF para pessoa, CNPJ para loja', () => {
    expect(validateRegister({ ...valid, document: '529.982.247-24' })).toEqual({ document: 'INVALID_DOCUMENT' });
    expect(validateRegister({ ...valid, document: '11.222.333/0001-81' })).toEqual({ document: 'INVALID_DOCUMENT' });
    expect(validateRegister({ ...valid, userType: 'MERCHANT', document: '11.222.333/0001-81' })).toEqual({});
    expect(validateRegister({ ...valid, userType: 'MERCHANT', document: '529.982.247-25' })).toEqual({ document: 'INVALID_DOCUMENT' });
  });

  // Quebra se: o limite voltar a contar caracteres. O servidor só aceita 72 BYTES (o BCrypt ignora o que vem depois): 40 letras "é" são 80 bytes.
  it('a senha também não passa de 72 bytes em UTF-8', () => {
    expect(validateRegister({ ...valid, password: 'é'.repeat(40) })).toEqual({ password: 'PASSWORD_LENGTH' });
    expect(validateRegister({ ...valid, password: 'é'.repeat(36) })).toEqual({});
    expect(validateRegister({ ...valid, password: 'x'.repeat(71) + 'é' })).toEqual({ password: 'PASSWORD_LENGTH' }); // 73 bytes
    expect(validateRegister({ ...valid, password: 'x'.repeat(70) + 'é' })).toEqual({}); // 72 bytes
  });

  // Quebra se: a senha curta ou longa demais passar, ou a senha for aparada (o espaço faz parte dela).
  it('a senha tem de 8 a 72 caracteres, contados como estão (espaços valem)', () => {
    expect(validateRegister({ ...valid, password: '1234567' })).toEqual({ password: 'PASSWORD_LENGTH' });
    expect(validateRegister({ ...valid, password: 'x'.repeat(73) })).toEqual({ password: 'PASSWORD_LENGTH' });
    expect(validateRegister({ ...valid, password: 'x'.repeat(72) })).toEqual({});
    expect(validateRegister({ ...valid, password: '       a' })).toEqual({});
  });
});

describe('validateLogin', () => {
  it('só exige que os dois campos estejam preenchidos (quem confere a senha é o servidor)', () => {
    expect(validateLogin('', '')).toEqual({ email: 'REQUIRED', password: 'REQUIRED' });
    expect(validateLogin(' ', 'x')).toEqual({ email: 'REQUIRED' });
    expect(validateLogin('a@b', '')).toEqual({ password: 'REQUIRED' });
    expect(validateLogin('qualquer coisa', 'curta')).toEqual({});
  });
});
