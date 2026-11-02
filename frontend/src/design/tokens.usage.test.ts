import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

// src/ (esta pasta é src/design). Caminho por node:path: o Vite reescreve `new URL('..', import.meta.url)` no jsdom.
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

const read = (file: string) => readFileSync(file, 'utf8');

// Quebra se: um componente usar var(--text2) (ou qualquer nome que não existe). O navegador ignora a
// declaração em silêncio e a cor simplesmente some, sem erro em lugar nenhum.
it('toda var(--x) usada nos CSS está definida', () => {
  const files = walk(SRC);
  const styles = files.filter((f) => f.endsWith('.css'));
  const sources = files.filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));

  const defined = new Set<string>();
  for (const file of styles) {
    for (const [, name] of read(file).matchAll(/(--[\w-]+)\s*:/g)) defined.add(name as string);
  }
  // Variáveis que o React grava em style={{ '--p': ... }} só existem em tempo de execução.
  for (const file of sources) {
    for (const [, name] of read(file).matchAll(/['"`](--[\w-]+)['"`]/g)) defined.add(name as string);
  }

  const missing: string[] = [];
  for (const file of styles) {
    for (const [, name] of read(file).matchAll(/var\(\s*(--[\w-]+)/g)) {
      if (!defined.has(name as string)) missing.push(`${file.replace(SRC, 'src/')}: ${name}`);
    }
  }
  expect(missing).toEqual([]);
});
