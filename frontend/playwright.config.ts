import { defineConfig } from '@playwright/test';

// Ponta a ponta contra o Quarkus de verdade (o jar de `mvn -B -ntp -DskipTests package`, que já leva o front dentro)
// e o stub dos serviços externos. Os dois sobem sozinhos; se já houver servidores de pé fora do CI, são reaproveitados.
const APP = 'http://localhost:8080';
const STUB = 'http://localhost:9000';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  // O stub é estado global e o H2 é um só: um teste por vez.
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: APP,
    // Idioma e fuso fixos: as datas do extrato saem iguais em qualquer máquina.
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'phone',
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
    // Notebook e tablet só importam para a vitrine (composição própria por faixa de largura).
    { name: 'notebook', testMatch: 'showcase.spec.ts', use: { viewport: { width: 1366, height: 768 } } },
    { name: 'tablet', testMatch: 'showcase.spec.ts', use: { viewport: { width: 768, height: 1024 } } },
  ],
  webServer: [
    {
      command: 'node ../scripts/stub-externals.mjs',
      url: `${STUB}/__calls`,
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
    {
      command: [
        'java',
        '-Dapp.seed.enabled=true',
        '-Dapp.jwt.cookie-secure=false',
        `-Dquarkus.rest-client.authorizer.url=${STUB}`,
        `-Dquarkus.rest-client.notifier.url=${STUB}`,
        '-jar ../target/quarkus-app/quarkus-run.jar',
      ].join(' '),
      url: `${APP}/hello`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
