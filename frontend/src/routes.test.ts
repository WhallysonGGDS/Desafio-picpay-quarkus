import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { ROUTES } from './routes';

// Quebra se: uma rota do app começar com um prefixo da API. Em produção o SpaFallback não a serviria (o prefixo
// é da API) e nenhum teste com o Quinoa desligado enxergaria: só a pessoa que atualiza a página.
it('nenhuma rota do app colide com os prefixos da API', () => {
  const properties = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../src/main/resources/application.properties'),
    'utf8',
  );
  const prefixes = (/^quarkus\.quinoa\.ignored-path-prefixes=(.+)$/m.exec(properties)?.[1] ?? '').split(',').map((p) => p.trim());
  expect(prefixes, 'a lista de prefixos foi lida').toEqual(expect.arrayContaining(['/auth', '/users', '/transaction']));

  for (const path of Object.values(ROUTES)) {
    for (const prefix of prefixes) {
      expect(path === prefix || path.startsWith(`${prefix}/`), `${path} x ${prefix}`).toBe(false);
    }
  }
});
