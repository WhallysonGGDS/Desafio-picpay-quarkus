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
});
