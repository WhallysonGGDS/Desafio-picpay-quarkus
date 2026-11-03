import { describe, expect, it } from 'vitest';
import { isExpectedNoise } from './console';

// O Chromium registra todo 401 como "Failed to load resource" no console, como erro. O GET /users/me de um visitante deslogado
// responde 401 por contrato (é assim que a vitrine e as telas públicas sabem que não há sessão): isso é ruído do navegador, não
// defeito. O filtro tem de ignorar exatamente isso e nada mais: qualquer outro erro de console reprova o teste.
describe('isExpectedNoise', () => {
  const FAILED = 'Failed to load resource: the server responded with a status of';

  // Quebra se: o 401 de visitante deslogado reprovar todo teste de console (a vitrine é pública: o 401 acontece sempre).
  it('o 401 de GET /users/me é esperado', () => {
    expect(isExpectedNoise({ text: `${FAILED} 401 (Unauthorized)`, url: 'http://localhost:8080/users/me' })).toBe(true);
  });

  // Quebra se: o filtro engolir erro de verdade (um 500 em /users/me é uma falha do servidor, não "deslogado").
  it.each([
    ['500 em /users/me', `${FAILED} 500 (Internal Server Error)`, 'http://localhost:8080/users/me'],
    ['401 em outra rota', `${FAILED} 401 (Unauthorized)`, 'http://localhost:8080/transaction'],
    ['404 de um arquivo', `${FAILED} 404 (Not Found)`, 'http://localhost:8080/assets/Showcase-abc.js'],
    ['erro de script', "Uncaught TypeError: Cannot read properties of undefined (reading 'x')", 'http://localhost:8080/assets/index.js'],
    ['erro de script que cita /users/me', 'TypeError em /users/me: 401', 'http://localhost:8080/assets/index.js'],
    ['sem URL', `${FAILED} 401 (Unauthorized)`, ''],
  ])('%s não é ruído', (_name, text, url) => {
    expect(isExpectedNoise({ text, url })).toBe(false);
  });

  it('o /users/me com busca na URL também conta', () => {
    expect(isExpectedNoise({ text: `${FAILED} 401 (Unauthorized)`, url: 'http://localhost:8080/users/me?x=1' })).toBe(true);
  });
});
