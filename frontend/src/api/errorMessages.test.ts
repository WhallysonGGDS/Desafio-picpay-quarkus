import { describe, expect, it } from 'vitest';
import { API_ERROR_CODES, ApiError } from './ApiError';
import { fieldMessage, messageFor, messageForCode } from './errorMessages';

const GENERIC = 'Não foi possível concluir. Tente de novo.';

describe('messageForCode', () => {
  // Quebra se: o texto de quem só guarda o código (o fluxo de transferência guarda o código do último erro, não o
  // erro) divergir do texto de quem tem o erro na mão: a mesma falha diria duas coisas diferentes.
  it('dá o mesmo texto que messageFor dá ao erro com esse código', () => {
    for (const code of API_ERROR_CODES) {
      expect(messageForCode(code), code).toBe(messageFor(new ApiError(0, code, [])));
    }
  });

  it('código que não é nosso (HTTP_<status>, ou qualquer texto) cai no texto genérico', () => {
    expect(messageForCode('HTTP_415')).toBe(GENERIC);
    expect(messageForCode('CODIGO_NOVO')).toBe(GENERIC);
  });
});

describe('messageFor', () => {
  // Quebra se: um código novo entrar na lista sem texto próprio e cair, sem ninguém notar, no texto genérico.
  it('todo código conhecido, exceto UNKNOWN, tem texto próprio', () => {
    for (const code of API_ERROR_CODES.filter((c) => c !== 'UNKNOWN')) {
      expect(messageFor(new ApiError(0, code, [])), code).not.toBe(GENERIC);
    }
  });

  // Quebra se: o texto do motivo mudar sem querer. São frases que a pessoa lê quando o dinheiro não saiu.
  it.each([
    ['INSUFFICIENT_BALANCE', 'Saldo insuficiente para este valor.'],
    ['AUTHORIZATION_DENIED', 'O serviço de autorização recusou esta transferência. Seu saldo não mudou.'],
    ['AUTHORIZER_UNAVAILABLE', 'O serviço de autorização está fora do ar. Seu saldo não mudou. Tente de novo em instantes.'],
    ['INVALID_CREDENTIALS', 'E-mail ou senha incorretos.'],
    ['UNAUTHENTICATED', 'Sua sessão terminou. Entre de novo.'],
    ['MERCHANT_CANNOT_SEND', 'Lojas recebem transferências, mas não enviam.'],
    ['DUPLICATE_EMAIL', 'Já existe uma carteira com esse e-mail.'],
    ['DUPLICATE_DOCUMENT', 'Já existe uma carteira com esse documento.'],
  ] as const)('%s → "%s"', (code, text) => {
    expect(messageFor(new ApiError(400, code, []))).toBe(text);
  });

  // Quebra se: falha de rede e erro de servidor passarem a dizer a mesma coisa (a spec exige estados distintos).
  it('falha de rede e erro de servidor têm textos diferentes', () => {
    expect(messageFor(new ApiError(0, 'NETWORK', []))).toBe('Sem conexão com o servidor.');
    expect(messageFor(new ApiError(500, 'INTERNAL_ERROR', []))).toBe('Algo deu errado do nosso lado. Tente de novo.');
  });

  it('status HTTP sem código próprio e UNKNOWN caem no texto genérico', () => {
    expect(messageFor(new ApiError(502, 'HTTP_502', []))).toBe(GENERIC);
    expect(messageFor(new ApiError(418, 'HTTP_418', []))).toBe(GENERIC);
    expect(messageFor(new ApiError(400, 'UNKNOWN', []))).toBe(GENERIC);
  });

  it('erro que não é ApiError cai no texto genérico', () => {
    expect(messageFor(new Error('x'))).toBe(GENERIC);
    expect(messageFor('qualquer coisa')).toBe(GENERIC);
  });
});

describe('fieldMessage', () => {
  it.each([
    ['REQUIRED', 'Preencha este campo.'],
    ['TOO_LONG', 'Texto longo demais.'],
    ['INVALID_EMAIL', 'E-mail inválido.'],
    ['PASSWORD_LENGTH', 'A senha precisa ter de 8 a 72 caracteres.'],
    ['INVALID_DOCUMENT', 'Documento inválido.'],
    ['QUERY_TOO_SHORT', 'Digite ao menos 3 caracteres.'],
    ['INVALID_AMOUNT', 'Digite um valor válido, com até duas casas decimais.'],
  ])('%s → "%s"', (code, text) => {
    expect(fieldMessage(code)).toBe(text);
  });

  // Quebra se: um código de campo novo do back-end deixar a tela sem mensagem.
  it('código desconhecido vira "Valor inválido."', () => {
    expect(fieldMessage('INVALID_PAGE')).toBe('Valor inválido.');
  });
});
