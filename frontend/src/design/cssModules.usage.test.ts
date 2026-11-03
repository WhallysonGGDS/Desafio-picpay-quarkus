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

/** Os nomes de classe que um CSS Module define: `.nome` em qualquer seletor. */
function definedClasses(css: string): Set<string> {
  return new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((match) => match[1] as string));
}

// Quebra se: um componente usar `styles.line` (ou styles['line']) que o .module.css não define. O CSS Modules entrega
// `undefined`, o React renderiza sem classe, e a tela fica sem estilo, sem erro em lugar nenhum (foi assim que uma edição
// minha apagou as pontas do arco e a quebra de linha do título da vitrine sem nenhum teste reclamar).
it('toda classe usada via CSS Modules está definida no .module.css do componente', () => {
  const missing: string[] = [];

  for (const file of walk(SRC).filter((f) => /\.tsx$/.test(f) && !/\.test\.tsx$/.test(f))) {
    const source = read(file);
    for (const [, alias, path] of source.matchAll(/import\s+(\w+)\s+from\s+'(\.[^']*\.module\.css)'/g)) {
      const cssFile = join(dirname(file), path as string);
      const defined = definedClasses(read(cssFile));
      const used = new Set<string>();
      for (const [, name] of source.matchAll(new RegExp(`\\b${alias}\\.([A-Za-z_][\\w]*)`, 'g'))) used.add(name as string);
      for (const [, inside] of source.matchAll(new RegExp(`\\b${alias}\\[([^\\]]+)\\]`, 'g'))) {
        for (const [, name] of (inside as string).matchAll(/'([A-Za-z_][\w-]*)'/g)) used.add(name as string);
      }
      for (const name of used) {
        if (!defined.has(name)) missing.push(`${file.replace(SRC, 'src')}: ${alias}.${name} não existe em ${(path as string).replace('./', '')}`);
      }
    }
  }

  expect(missing).toEqual([]);
});
