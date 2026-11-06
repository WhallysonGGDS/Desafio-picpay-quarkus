import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { API_ERROR_CODES, ApiError } from './ApiError';

describe('API_ERROR_CODES', () => {
  // Quebra se: o back-end ganhar ou perder um código de erro e o front não acompanhar. O código é o contrato
  // (o OpenAPI não o lista), então a fonte da verdade é o enum ErrorCode do back-end.
  it('tem exatamente os códigos do ErrorCode do back-end, mais NETWORK e UNKNOWN', () => {
    const javaFile = join(dirname(fileURLToPath(import.meta.url)), '../../../src/main/java/dev/whallyson/exceptions/ErrorCode.java');
    const backend = [...readFileSync(javaFile, 'utf8').matchAll(/^\s{4}([A-Z][A-Z_]+)\(\d{3},/gm)].map((match) => match[1] as string);

    expect(backend, 'o enum foi lido').toEqual(expect.arrayContaining(['VALIDATION_ERROR', 'INTERNAL_ERROR']));
    expect([...API_ERROR_CODES].sort()).toEqual([...backend, 'NETWORK', 'UNKNOWN'].sort());
  });
});

describe('ApiError', () => {
  it('guarda statusCode, code e fieldErrors, e é um Error', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', [{ field: 'email', code: 'INVALID_EMAIL' }]);

    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.fieldErrors).toEqual([{ field: 'email', code: 'INVALID_EMAIL' }]);
    expect(error.message).toContain('VALIDATION_ERROR');
  });

  // Quebra se: um erro de servidor for tratado como falta de conexão (ou o contrário): são estados distintos na tela.
  it('só NETWORK é erro de rede', () => {
    expect(new ApiError(0, 'NETWORK', []).isNetwork).toBe(true);
    expect(new ApiError(500, 'INTERNAL_ERROR', []).isNetwork).toBe(false);
    expect(new ApiError(502, 'HTTP_502', []).isNetwork).toBe(false);
  });

  // Quebra se: o erro de um campo for atribuído a outro (a tela mostraria "e-mail inválido" sob a senha).
  it('fieldCode devolve o código do campo pedido, ou undefined', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', [
      { field: 'email', code: 'INVALID_EMAIL' },
      { field: 'password', code: 'PASSWORD_LENGTH' },
    ]);

    expect(error.fieldCode('password')).toBe('PASSWORD_LENGTH');
    expect(error.fieldCode('email')).toBe('INVALID_EMAIL');
    expect(error.fieldCode('document')).toBeUndefined();
  });
});
