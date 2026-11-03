import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMPACT_WINDOW_QUERY } from './motion';

const here = dirname(fileURLToPath(import.meta.url));
const css = (file: string) => readFileSync(join(here, file), 'utf8');

/** O corpo do `@media` da janela compacta num arquivo, ou null se ele não existe: o texto da consulta tem de ser o da constante. */
function compactBlock(source: string): string | null {
  const start = source.indexOf(`@media ${COMPACT_WINDOW_QUERY} {`);
  if (start === -1) return null;
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  return null;
}

// O motor decide (em JS, por COMPACT_WINDOW_QUERY) que uma cena fixada não prende; o CSS decide (por um @media escrito à mão)
// que ela perde a altura fixa. Se os dois textos divergirem, há janelas em que a cena não prende mas continua com altura de
// janela e o conteúdo some, ou prende sem a altura. O jsdom não aplica CSS: o que une os dois é este teste.
describe('janela compacta (celular deitado): o CSS e o motor falam da mesma janela', () => {
  it('a cena fixada perde a altura fixa e o corte, na mesma consulta do motor', () => {
    const block = compactBlock(css('showcase.module.css'));

    expect(block, `showcase.module.css precisa de @media ${COMPACT_WINDOW_QUERY}`).not.toBeNull();
    expect(block).toMatch(/\.scene\[data-pinned\]\s*\{[^}]*height:\s*auto/);
    expect(block).toMatch(/\.scene\[data-pinned\]\s*\{[^}]*overflow:\s*visible/);
  });

  it('o palco do contexto vira uma coluna estreita e alta, para o arco ficar vertical', () => {
    const block = compactBlock(css('scenes/Context.module.css'));

    expect(block, `Context.module.css precisa de @media ${COMPACT_WINDOW_QUERY}`).not.toBeNull();
    expect(block).toMatch(/\.stage\s*\{[^}]*width:\s*min\(100%,\s*28rem\)/);
    expect(block).toMatch(/\.stage\s*\{[^}]*min-height:\s*36rem/);
  });
});
