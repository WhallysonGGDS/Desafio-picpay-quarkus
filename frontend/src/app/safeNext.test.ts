import { describe, expect, it } from 'vitest';
import { safeNext } from './safeNext';

// RF3: o `next` do login vem da URL, ou seja, de quem a montou. Só pode levar a um caminho da própria origem.
describe('safeNext (RF3)', () => {
  // Quebra se: um caminho legítimo do app for recusado (o login perderia o destino que a pessoa tentou abrir).
  it.each([
    ['/transferir', '/transferir'],
    ['/extrato?x=1', '/extrato?x=1'],
    ['/carteira#topo', '/carteira#topo'],
    ['/%2Fevil.com', '/%2Fevil.com'], // barra codificada continua sendo caminho da própria origem
  ])('aceita o caminho interno %j', (raw, expected) => {
    expect(safeNext(raw)).toBe(expected);
  });

  // Quebra se: um destino externo passar. O login mandaria a pessoa, já autenticada, para o site de outra pessoa.
  it.each([
    'https://evil.com',
    'http:evil.com',
    '//evil.com',
    '/\\evil.com',
    '\\\\evil.com',
    'javascript:alert(1)',
    'data:text/html,x',
    'carteira',
    ' /transferir',
    '',
    // O navegador remove tab e quebra de linha ao interpretar a URL: "/\t/evil.com" viraria "//evil.com".
    '/\t/evil.com',
    '/\n/evil.com',
    '/\r/evil.com',
  ])('recusa %j', (raw) => {
    expect(safeNext(raw)).toBe('/carteira');
  });

  it('null e undefined usam o destino padrão, que pode ser trocado', () => {
    expect(safeNext(null)).toBe('/carteira');
    expect(safeNext(undefined)).toBe('/carteira');
    expect(safeNext('//evil.com', '/extrato')).toBe('/extrato');
  });
});
