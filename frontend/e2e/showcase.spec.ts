import { expect, test } from '@playwright/test';
import { collectConsoleErrors } from './support/console';
import { DEMO, signIn } from './support/users';

const scenes = (page: import('@playwright/test').Page) => page.locator('[data-scene]');
const progress = (page: import('@playwright/test').Page) =>
  scenes(page).evaluateAll((elements) => elements.map((element) => element.getAttribute('data-progress')));

test('a vitrine carrega GSAP e Lenis sob demanda', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (/^\/assets\/.*\.js$/.test(pathname)) scripts.push(pathname.replace(/^\/assets\//, ''));
  });

  // Quem entra pelo app (logado, em /carteira) baixa só o pacote de entrada: nada de GSAP nem de Lenis.
  await signIn(page, DEMO.marina);
  await page.goto('/carteira');
  await expect(page.getByTestId('wallet-balance')).toBeVisible();
  expect(scripts.filter((name) => /^Showcase-/.test(name))).toEqual([]);
  expect(scripts).toHaveLength(1);
  expect(scripts[0]).toMatch(/^index-/);

  // Na vitrine, exatamente um pacote a mais: o dela (GSAP, ScrollTrigger e Lenis só existem lá dentro).
  scripts.length = 0;
  await page.goto('/');
  await expect(scenes(page)).toHaveCount(6);
  expect(scripts.filter((name) => /^Showcase-/.test(name))).toHaveLength(1);
});

test('o progresso das cenas avança com o scroll', async ({ page }) => {
  await page.goto('/');
  await expect(scenes(page)).toHaveCount(6);

  // No topo, nada andou: seis zeros, no formato de três casas.
  expect(await progress(page)).toEqual(Array(6).fill('0.000'));

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.5));
  await expect.poll(async () => (await progress(page)).some((value) => value !== '0.000')).toBe(true);

  // No meio da página: todo progresso fica entre 0 e 1, e as cenas de cima estão sempre à frente das de baixo.
  const values = (await progress(page)).map(Number);
  for (const value of values) {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  }
  for (let index = 1; index < values.length; index += 1) {
    expect(values[index - 1], `cena ${index} deve estar à frente da ${index + 1}`).toBeGreaterThanOrEqual(values[index] as number);
  }
  expect(values[0]).toBe(1);
  expect(values[5]).toBe(0);
});

// RF5. Quem pediu menos movimento recebe a vitrine toda legível, sem cenas presas.
test.describe('movimento reduzido', () => {
  test.use({ reducedMotion: 'reduce' });

  test('movimento reduzido: tudo legível, sem pins', async ({ page }) => {
    await page.goto('/');
    await expect(scenes(page)).toHaveCount(6);

    await expect(page.locator('.pin-spacer')).toHaveCount(0);
    expect(await progress(page)).toEqual(Array(6).fill('1.000'));
    for (const scene of await scenes(page).all()) {
      await scene.scrollIntoViewIfNeeded();
      await expect(scene.getByRole('heading').first()).toBeVisible();
    }
  });
});

test('o teclado alcança o CTA sem armadilha', async ({ page }) => {
  await page.goto('/');
  await expect(scenes(page)).toHaveCount(6);

  let reached = false;
  for (let tabs = 1; tabs <= 40 && !reached; tabs += 1) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(() => document.activeElement?.textContent?.includes('Abrir minha carteira') ?? false);
  }

  expect(reached, 'o CTA "Abrir minha carteira" deve receber o foco em até 40 Tabs').toBe(true);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/criar-conta');
});

test('sem erros de console em desktop e celular', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto('/');
  await expect(scenes(page)).toHaveCount(6);

  // Percorre a página inteira, devagar, para cada cena (e cada pin) passar pelo que tem de passar.
  for (let step = 0; step < 40; step += 1) {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(80);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  expect(errors()).toEqual([]);
});
