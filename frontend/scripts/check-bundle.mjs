#!/usr/bin/env node
// Orçamento do bundle: o que o app baixa antes de mostrar uma tela (a entrada) e o pacote da vitrine, medidos em gzip.
//
//   node scripts/check-bundle.mjs [--dist <pasta>]     (padrão: frontend/dist, o que `npm run build` gera)
//
// Falha (código 1) se a entrada passar de 170 kB, se a vitrine passar de 70 kB, ou se a entrada levar o GSAP, o ScrollTrigger ou o
// Lenis: eles só existem no pacote da vitrine (é por isso que ela é um pacote à parte, carregado sob demanda). kB são 1000
// bytes, como o Vite os mostra.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const BUDGET = { entry: 170_000, showcase: 70_000 };

// Bibliotecas de movimento: se aparecerem na entrada, a vitrine perdeu o sentido de ser um pacote à parte.
const HEAVY = ['gsap', 'ScrollTrigger', 'lenis'];

const kB = (bytes) => (bytes / 1000).toFixed(2);
const gzipBytes = (source) => gzipSync(source).length;
const text = (source) => (typeof source === 'string' ? source : Buffer.from(source).toString('utf8'));

/** Os .js que o index.html carrega de saída: o <script type="module"> da entrada e o que ele pré-carrega (modulepreload). */
function entryNames(indexHtml) {
  const names = [];
  for (const match of indexHtml.matchAll(/<script\b[^>]*\bsrc="([^"]+\.js)"/g)) names.push(basename(match[1]));
  for (const tag of indexHtml.matchAll(/<link\b[^>]*>/g)) {
    if (!/\brel="modulepreload"/.test(tag[0])) continue;
    const href = /\bhref="([^"]+\.js)"/.exec(tag[0]);
    if (href) names.push(basename(href[1]));
  }
  return names;
}

/**
 * Confere o build. `assets` são os arquivos de `dist/assets` (nome e conteúdo); `indexHtml`, o `dist/index.html`.
 * Devolve os tamanhos (gzip) e as falhas, uma frase cada: lista vazia é build dentro do orçamento.
 */
export function checkBundle({ indexHtml, assets, budget = BUDGET }) {
  const js = new Map(assets.filter((asset) => asset.name.endsWith('.js')).map((asset) => [asset.name, asset.source]));
  const failures = [];

  const names = entryNames(indexHtml);
  const files = [];
  if (names.length === 0) failures.push('não achei o pacote de entrada: o index.html não carrega nenhum <script type="module">');
  for (const name of names) {
    const source = js.get(name);
    if (source === undefined) {
      failures.push(`o index.html carrega ${name}, que não está em assets`);
      continue;
    }
    files.push({ name, gzip: gzipBytes(source) });
    for (const word of HEAVY) {
      if (text(source).includes(word)) {
        failures.push(`a entrada (${name}) contém "${word}": o GSAP, o ScrollTrigger e o Lenis só podem estar no pacote da vitrine`);
      }
    }
  }
  const entry = { files, gzip: files.reduce((sum, file) => sum + file.gzip, 0) };
  if (files.length > 0 && entry.gzip > budget.entry) {
    failures.push(`a entrada (${files.map((file) => file.name).join(' + ')}) tem ${kB(entry.gzip)} kB gzip, acima do orçamento de ${kB(budget.entry)} kB`);
  }

  const showcaseName = [...js.keys()].find((name) => name.startsWith('Showcase'));
  let showcase = null;
  if (showcaseName === undefined) {
    failures.push('não achei o pacote da vitrine (Showcase-*.js) em assets');
  } else {
    showcase = { name: showcaseName, gzip: gzipBytes(js.get(showcaseName)) };
    if (showcase.gzip > budget.showcase) {
      failures.push(`a vitrine (${showcase.name}) tem ${kB(showcase.gzip)} kB gzip, acima do orçamento de ${kB(budget.showcase)} kB`);
    }
  }

  return { entry, showcase, failures };
}

function main() {
  const flag = process.argv.indexOf('--dist');
  const dist = resolve(flag === -1 ? join(dirname(fileURLToPath(import.meta.url)), '..', 'dist') : process.argv[flag + 1] ?? '');
  const index = join(dist, 'index.html');
  if (!existsSync(index)) {
    console.error(`não achei ${index}: rode \`npm run build\` antes`);
    process.exit(1);
  }

  const assetsDir = join(dist, 'assets');
  const assets = existsSync(assetsDir)
    ? readdirSync(assetsDir).map((name) => ({ name, source: readFileSync(join(assetsDir, name)) }))
    : [];
  const report = checkBundle({ indexHtml: readFileSync(index, 'utf8'), assets });

  const line = (label, names, gzip, limit) => `${label.padEnd(8)} ${names.padEnd(30)} ${kB(gzip).padStart(7)} kB gzip   (limite ${kB(limit)} kB)`;
  if (report.entry.files.length > 0) {
    console.log(line('entrada', report.entry.files.map((file) => file.name).join(' + '), report.entry.gzip, BUDGET.entry));
  }
  if (report.showcase) console.log(line('vitrine', report.showcase.name, report.showcase.gzip, BUDGET.showcase));

  for (const failure of report.failures) console.error(`FALHOU: ${failure}`);
  process.exit(report.failures.length === 0 ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
