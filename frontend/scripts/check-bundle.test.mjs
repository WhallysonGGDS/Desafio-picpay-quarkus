import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { BUDGET, checkBundle } from './check-bundle.mjs';

const script = join(dirname(fileURLToPath(import.meta.url)), 'check-bundle.mjs');

// Bytes que não comprimem (o gzip de um texto repetido seria minúsculo e o teste não mediria nada): uma sequência pseudoaleatória
// fixa, para o tamanho gzip ser quase o tamanho de entrada.
function incompressible(length) {
  const bytes = Buffer.alloc(length);
  let state = 123456789;
  for (let index = 0; index < length; index += 1) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    bytes[index] = state >>> 24;
  }
  return bytes;
}
const gzipSize = (source) => gzipSync(source).length; // o nível padrão, o mesmo que o Vite usa nos tamanhos que mostra

const INDEX = (entry, extra = '') => `<!doctype html><html><head><script type="module" crossorigin src="/assets/${entry}"></script>${extra}</head><body><div id="root"></div></body></html>`;
const ok = {
  indexHtml: INDEX('index-AbC123.js'),
  assets: [
    { name: 'index-AbC123.js', source: 'console.log("app")' },
    { name: 'Showcase-XyZ789.js', source: 'console.log("vitrine gsap ScrollTrigger lenis")' },
    { name: 'index-AbC123.css', source: 'body{}' },
  ],
};

describe('checkBundle', () => {
  // Quebra se: o pacote de entrada ou o da vitrine não for achado pelo nome certo (index.html e prefixo Showcase), ou os
  // tamanhos não forem gzip de verdade.
  it('acha a entrada pelo index.html e a vitrine pelo nome, e mede o gzip', () => {
    const report = checkBundle(ok);

    expect(report.failures).toEqual([]);
    expect(report.entry.files.map((file) => file.name)).toEqual(['index-AbC123.js']);
    expect(report.entry.files[0].gzip).toBe(gzipSize('console.log("app")'));
    expect(report.showcase.name).toBe('Showcase-XyZ789.js');
    expect(report.showcase.gzip).toBe(gzipSize('console.log("vitrine gsap ScrollTrigger lenis")'));
  });

  it('o orçamento é 170 kB para a entrada e 70 kB para a vitrine (kB = 1000 bytes, como o Vite os mostra)', () => {
    expect(BUDGET).toEqual({ entry: 170_000, showcase: 70_000 });
  });

  // Quebra se: um pacote de entrada acima do orçamento passar (o app todo baixaria isso antes de mostrar uma tela).
  it('reprova a entrada acima do orçamento', () => {
    const big = incompressible(300);
    const report = checkBundle({ ...ok, assets: [{ name: 'index-AbC123.js', source: big }, ok.assets[1]], budget: { entry: 100, showcase: 70_000 } });

    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]).toMatch(/entrada.*index-AbC123\.js.*orçamento/);
  });

  it('o limite é inclusivo: exatamente no orçamento passa, um byte acima reprova', () => {
    const size = gzipSize('console.log("app")');

    expect(checkBundle({ ...ok, budget: { entry: size, showcase: 70_000 } }).failures).toEqual([]);
    expect(checkBundle({ ...ok, budget: { entry: size - 1, showcase: 70_000 } }).failures).toHaveLength(1);
  });

  // Quebra se: a vitrine (GSAP, ScrollTrigger e Lenis) crescer além do orçamento dela.
  it('reprova a vitrine acima do orçamento', () => {
    const report = checkBundle({ ...ok, assets: [ok.assets[0], { name: 'Showcase-XyZ789.js', source: incompressible(300) }], budget: { entry: 170_000, showcase: 100 } });

    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]).toMatch(/vitrine.*Showcase-XyZ789\.js.*orçamento/);
  });

  // Quebra se: o GSAP, o ScrollTrigger ou o Lenis voltarem para o pacote de entrada (o ponto de ter a vitrine à parte).
  it.each(['gsap', 'ScrollTrigger', 'lenis'])('reprova a entrada que contém "%s", mesmo dentro do orçamento', (word) => {
    const report = checkBundle({ ...ok, assets: [{ name: 'index-AbC123.js', source: `var x="${word}";` }, ok.assets[1]] });

    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]).toContain(word);
  });

  // Quebra se: um pacote carregado junto com a entrada (modulepreload) escapar da conta e do filtro das bibliotecas pesadas.
  it('conta também o que o index.html pré-carrega junto com a entrada', () => {
    const report = checkBundle({
      indexHtml: INDEX('index-AbC123.js', '<link rel="modulepreload" crossorigin href="/assets/vendor-Q1w2.js">'),
      assets: [...ok.assets, { name: 'vendor-Q1w2.js', source: 'var g="gsap";' }],
    });

    expect(report.entry.files.map((file) => file.name)).toEqual(['index-AbC123.js', 'vendor-Q1w2.js']);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]).toContain('vendor-Q1w2.js');
  });

  // Quebra se: o limite da vitrine for exclusivo (exatamente 70 kB reprovaria), como o da entrada.
  it('o limite da vitrine também é inclusivo', () => {
    const size = gzipSize('console.log("vitrine gsap ScrollTrigger lenis")');

    expect(checkBundle({ ...ok, budget: { entry: 170_000, showcase: size } }).failures).toEqual([]);
    expect(checkBundle({ ...ok, budget: { entry: 170_000, showcase: size - 1 } }).failures).toHaveLength(1);
  });

  // Quebra se: a conta da entrada olhar só o primeiro arquivo: o que o index.html pré-carrega também é baixado antes da tela.
  it('o orçamento da entrada é a soma da entrada e do que ela pré-carrega', () => {
    const html = INDEX('index-AbC123.js', '<link rel="modulepreload" crossorigin href="/assets/vendor-Q1w2.js">');
    const assets = [
      { name: 'index-AbC123.js', source: incompressible(400) },
      { name: 'vendor-Q1w2.js', source: incompressible(400) },
      ok.assets[1],
    ];
    const total = gzipSize(assets[0].source) + gzipSize(assets[1].source);

    expect(checkBundle({ indexHtml: html, assets, budget: { entry: total, showcase: 70_000 } }).failures).toEqual([]);
    expect(checkBundle({ indexHtml: html, assets, budget: { entry: total - 1, showcase: 70_000 } }).failures).toHaveLength(1);
  });

  // Quebra se: um <link> que não é modulepreload (um prefetch do pacote da vitrine, por exemplo) contar como parte da entrada.
  it('só o modulepreload conta como parte da entrada: um prefetch da vitrine não', () => {
    const report = checkBundle({
      ...ok,
      indexHtml: INDEX('index-AbC123.js', '<link rel="prefetch" href="/assets/Showcase-XyZ789.js">'),
    });

    expect(report.failures).toEqual([]);
    expect(report.entry.files.map((file) => file.name)).toEqual(['index-AbC123.js']);
  });

  // Quebra se: o .css da vitrine (Showcase-xxxx.css, que no build vem antes do .js na pasta) for tomado pelo pacote dela: o
  // orçamento mediria 2 kB de CSS em vez dos 55 kB de JS.
  it('o pacote da vitrine é o .js, não o .css de mesmo prefixo', () => {
    const report = checkBundle({ ...ok, assets: [{ name: 'Showcase-XyZ789.css', source: 'a{}' }, ...ok.assets] });

    expect(report.showcase.name).toBe('Showcase-XyZ789.js');
  });

  // Quebra se: o kB mudar de 1000 para 1024 bytes (os números deixariam de bater com os que o Vite mostra no build).
  it('diz os tamanhos em kB de 1000 bytes, com duas casas', () => {
    const big = incompressible(2000);
    const size = gzipSize(big);
    const report = checkBundle({ ...ok, assets: [{ name: 'index-AbC123.js', source: big }, ok.assets[1]], budget: { entry: 1, showcase: 70_000 } });

    expect(report.failures[0]).toContain(`${(size / 1000).toFixed(2)} kB gzip`);
  });

  // Quebra se: um build sem entrada identificável, ou sem o pacote da vitrine, passar em silêncio (o orçamento não mediria nada).
  it('reprova quando não acha a entrada ou o pacote da vitrine', () => {
    expect(checkBundle({ indexHtml: '<html></html>', assets: ok.assets }).failures.join()).toMatch(/entrada/);
    expect(checkBundle({ ...ok, assets: [ok.assets[0]] }).failures.join()).toMatch(/vitrine/);
    expect(checkBundle({ ...ok, assets: [ok.assets[1]] }).failures.join()).toMatch(/index-AbC123\.js/);
  });
});

describe('check-bundle (linha de comando)', () => {
  function distWith({ entry, showcase }) {
    const dist = mkdtempSync(join(tmpdir(), 'arco-dist-'));
    mkdirSync(join(dist, 'assets'));
    writeFileSync(join(dist, 'index.html'), INDEX('index-AbC123.js'));
    writeFileSync(join(dist, 'assets', 'index-AbC123.js'), entry);
    writeFileSync(join(dist, 'assets', 'Showcase-XyZ789.js'), showcase);
    return dist;
  }
  const run = (dist) => spawnSync(process.execPath, [script, '--dist', dist], { encoding: 'utf8' });

  it('imprime os tamanhos e sai com 0 quando está no orçamento', () => {
    const result = run(distWith({ entry: 'console.log("app")', showcase: 'console.log("gsap")' }));

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/entrada.*index-AbC123\.js.*kB/);
    expect(result.stdout).toMatch(/vitrine.*Showcase-XyZ789\.js.*kB/);
  });

  it('sai com 1 e diz o motivo quando a entrada leva o GSAP', () => {
    const result = run(distWith({ entry: 'var a="gsap";', showcase: 'x' }));

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/gsap/);
  });

  it('sai com 1 quando a pasta do build não existe', () => {
    const result = run(join(tmpdir(), 'arco-dist-que-nao-existe'));

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/npm run build/);
  });
});
