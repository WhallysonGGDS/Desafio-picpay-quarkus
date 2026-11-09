import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// O jsdom não calcula layout: o que decide se o componente cabe numa coluna estreita só se garante lendo o CSS-fonte. Caminho
// por node:path (o Vite reescreve `new URL(..., import.meta.url)` no jsdom).
const css = () => readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'WalletBalance.module.css'), 'utf8');

describe('WalletBalance.module.css (layout)', () => {
  // Quebra se: as duas colunas voltarem a depender da largura da JANELA. A vitrine põe o componente numa coluna estreita de uma
  // janela larga: pela janela ele acharia que há espaço, e o saldo gigante estouraria a coluna.
  it('o layout de duas colunas depende da largura que o componente recebe, não da janela', () => {
    expect(css()).toMatch(/@container\s*\(min-width:\s*[\d.]+rem\)/);
    expect(css()).not.toMatch(/@media\s*\(min-width/);
  });

  // Quebra se: o componente não for ele mesmo o contêiner (a consulta de contêiner não acharia a quem perguntar).
  it('o contêiner da consulta é o próprio componente', () => {
    expect(css()).toMatch(/\.frame\s*\{[^}]*container-type:\s*inline-size/);
  });
});
