import type { ConsoleMessage, Page } from '@playwright/test';

export interface ConsoleEntry {
  text: string;
  url: string;
}

/**
 * O ruído que o navegador faz e que não é defeito: o 401 de `GET /users/me` (visitante deslogado: é assim que as telas
 * públicas sabem que não há sessão). Só isso: um 500 nessa rota, ou um 401 em qualquer outra, continua sendo erro.
 */
export function isExpectedNoise({ text, url }: ConsoleEntry): boolean {
  let path = '';
  try {
    path = new URL(url).pathname;
  } catch {
    return false;
  }
  return path === '/users/me' && /status of 401\b/.test(text);
}

/** Começa a escutar os erros de console e as exceções da página; devolve quem lê o que foi visto (sem o ruído esperado). */
export function collectConsoleErrors(page: Page): () => string[] {
  const seen: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() !== 'error') return;
    const entry = { text: message.text(), url: message.location().url };
    if (!isExpectedNoise(entry)) seen.push(`${entry.text} (${entry.url || 'sem URL'})`);
  });
  page.on('pageerror', (error) => seen.push(`exceção: ${error.message}`));
  return () => [...seen];
}
