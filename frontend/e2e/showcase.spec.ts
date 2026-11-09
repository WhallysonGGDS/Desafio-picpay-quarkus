import { expect, test, type Page } from '@playwright/test';
import { collectConsoleErrors } from './support/console';
import { sceneBalanceCents, scrollToScene } from './support/scroll';
import { shot } from './support/shot';
import { DEMO, signIn } from './support/users';

const scenes = (page: Page) => page.locator('[data-scene]');
const progress = (page: Page) =>
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

test.describe('cenas', () => {
  // Cena 3: o saldo é texto, e acompanha o scroll em centavos inteiros.
  test('cena 3: o saldo cai de R$ 1.000,00 para R$ 750,00 conforme o scroll', async ({ page }) => {
    await page.goto('/');
    await expect(scenes(page)).toHaveCount(6);

    await scrollToScene(page, 3, 0);
    await expect.poll(() => sceneBalanceCents(page)).toBe(100_000);
    await expect(page.getByTestId('wallet-balance')).toHaveText('R$ 1.000,00');

    // Oito pontos no meio do caminho: nunca sobe, e fica entre os dois extremos.
    const seen: number[] = [];
    for (let step = 1; step <= 8; step += 1) {
      await scrollToScene(page, 3, 0.5 + step * 0.055);
      seen.push(await sceneBalanceCents(page));
    }
    for (const cents of seen) {
      expect(cents).toBeGreaterThanOrEqual(75_000);
      expect(cents).toBeLessThanOrEqual(100_000);
    }
    for (let index = 1; index < seen.length; index += 1) {
      expect(seen[index] as number, `ponto ${index + 1}`).toBeLessThanOrEqual(seen[index - 1] as number);
    }
    expect(new Set(seen).size, 'o saldo tem de estar andando').toBeGreaterThan(1);

    await scrollToScene(page, 3, 1);
    await expect.poll(() => sceneBalanceCents(page)).toBe(75_000);
    await expect(page.getByTestId('wallet-balance')).toHaveText('R$ 750,00');
    // `exact`: a linha tem também a frase para leitor de tela ("Enviado para Rafael Costa em …"), que não é o nome à vista.
    await expect(page.locator('[data-scene="3"]').getByText('Rafael Costa', { exact: true })).toBeVisible();
  });

  test('as quatro decisões da cena 2 aparecem com o texto da spec, acesas ao fim', async ({ page }) => {
    await page.goto('/');
    await expect(scenes(page)).toHaveCount(6);
    await scrollToScene(page, 2, 1);

    const scene = page.locator('[data-scene="2"]');
    const decisions: [string, string][] = [
      ['Quem envia?', 'Pessoas enviam. Lojas recebem.'],
      ['Há saldo?', 'Sem saldo, nada acontece.'],
      ['Alguém autoriza?', 'Um serviço externo decide.'],
      ['Os dois sabem?', 'Quem envia e quem recebe são avisados.'],
    ];
    for (const [question, answer] of decisions) {
      const heading = scene.getByRole('heading', { level: 3, name: question });
      await expect(heading).toBeVisible();
      // o texto acende com a luz: ao fim do arco, a opacidade é 1
      await expect(heading.locator('..')).toHaveCSS('opacity', '1');
      await expect(scene.getByText(answer)).toBeVisible();
    }
  });

  test('CTA e links levam aonde dizem', async ({ page }) => {
    await page.goto('/');
    await expect(scenes(page)).toHaveCount(6);

    await page.getByRole('link', { name: 'Entrar' }).click();
    await expect(page).toHaveURL('/entrar');

    await page.goto('/');
    await page.getByRole('link', { name: 'Já tenho conta' }).click();
    await expect(page).toHaveURL('/entrar');

    await page.goto('/');
    await page.getByRole('link', { name: 'Abrir minha carteira' }).click();
    await expect(page).toHaveURL('/criar-conta');
  });

  test('logado, o CTA vai para /carteira e o topo mostra "Carteira"', async ({ page }) => {
    await signIn(page, DEMO.marina);
    await page.goto('/');
    await expect(scenes(page)).toHaveCount(6);

    await expect(page.getByRole('link', { name: 'Carteira', exact: true })).toHaveAttribute('href', '/carteira');
    await expect(page.getByRole('link', { name: 'Entrar' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Já tenho conta' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Abrir minha carteira' }).click();
    await expect(page).toHaveURL('/carteira');
  });

  test('o rodapé traz o crédito do desafio com o texto exato', async ({ page }) => {
    await page.goto('/');
    await expect(scenes(page)).toHaveCount(6);

    await expect(page.getByText('Implementação do desafio PicPay Simplificado, com Quarkus e React', { exact: true })).toBeAttached();
    await expect(page.locator('[data-scene="6"]').getByText('Implementação do desafio PicPay Simplificado, com Quarkus e React')).toHaveText(
      'Implementação do desafio PicPay Simplificado, com Quarkus e React',
    );
  });

  // Composição própria por faixa: o arco da cena 2 segue a proporção da caixa, não a largura da janela.
  test('o arco da cena 2 é horizontal em tela larga e vertical quando a caixa fica em pé', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(scenes(page)).toHaveCount(6);
    const upright = ['phone', 'tablet'].includes(testInfo.project.name);

    const arc = page.locator('[data-scene="2"] svg[data-arc]');
    await expect(arc).toHaveCount(1);
    await expect(arc).toHaveAttribute('data-arc', upright ? 'v' : 'h');
    // e a página nunca rola na horizontal
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  // As fixadas ocupam a janela inteira e o que há dentro cabe: nada cortado pelo overflow que as contém.
  test('cenas fixadas (2 e 3) cabem na altura da janela', async ({ page }) => {
    await page.goto('/');
    await expect(scenes(page)).toHaveCount(6);

    for (const id of [2, 3]) {
      await scrollToScene(page, id, 0.5);
      const fit = await page.locator(`[data-scene="${id}"]`).evaluate((scene) => {
        const rect = scene.getBoundingClientRect();
        return {
          withinWindow: rect.top >= -0.5 && rect.bottom <= window.innerHeight + 0.5,
          notClipped: scene.scrollHeight <= scene.clientHeight + 1,
        };
      });
      expect(fit, `cena ${id}`).toEqual({ withinWindow: true, notClipped: true });
    }
  });

  test('cada cena aparece, no tamanho da janela, e as capturas ficam para a revisão visual', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    await expect(scenes(page)).toHaveCount(6);

    await page.waitForTimeout(1200);
    await shot(page, 'vitrine-1a-abertura-desenhando', { settled: false });
    await page.waitForTimeout(3600);
    await shot(page, 'vitrine-1b-abertura');
    await scrollToScene(page, 2, 0.45);
    await shot(page, 'vitrine-2a-contexto-a-meio');
    await scrollToScene(page, 2, 1);
    await page.waitForTimeout(300);
    await shot(page, 'vitrine-2b-contexto');
    await scrollToScene(page, 3, 0.75);
    await shot(page, 'vitrine-3a-proposta-saldo-caindo');
    await scrollToScene(page, 3, 1);
    await page.waitForTimeout(900);
    await shot(page, 'vitrine-3b-proposta');
    await scrollToScene(page, 4, 0.55);
    await shot(page, 'vitrine-4-detalhes');
    await scrollToScene(page, 5, 0.58);
    await shot(page, 'vitrine-5-climax');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.getByRole('link', { name: 'Abrir minha carteira' })).toBeVisible();
    await page.waitForTimeout(500);
    await shot(page, 'vitrine-6-conversao');
  });
});

test.describe('movimento reduzido: o saldo final, sem animação', () => {
  test.use({ reducedMotion: 'reduce' });

  test('a cena 3 já mostra R$ 750,00 e a linha do crédito, sem rolar', async ({ page }) => {
    await page.goto('/');
    await expect(scenes(page)).toHaveCount(6);

    await expect(page.getByTestId('wallet-balance')).toHaveText('R$ 750,00');
    await expect(page.locator('[data-scene="3"]').getByText('Rafael Costa', { exact: true })).toBeVisible();
    await expect(page.locator('.pin-spacer')).toHaveCount(0);
  });

  // RF5: "legível" é opaco de verdade. O toBeVisible do Playwright aceita opacity 0, então a opacidade efetiva (a do elemento
  // vezes a de cada ancestral) é lida à parte, em todo texto de cada cena; e a luz da abertura já nasce desenhada.
  test('o texto de cada cena está opaco e a luz da abertura já está desenhada', async ({ page }) => {
    await page.goto('/');
    await expect(scenes(page)).toHaveCount(6);

    const texts = page.locator(
      [
        '[data-scene] :is(h1, h2, h3)',
        '[data-scene="1"] header a',
        '[data-scene="2"] li p',
        '[data-scene="3"] [data-testid="wallet-balance"]',
        '[data-scene="4"] li p',
        '[data-scene="5"] p',
        '[data-scene="6"] :is(a, footer)',
      ].join(', '),
    );
    // 1 h1, 4 h2, 7 h3, o link do topo, 4 + 3 respostas, o saldo, a frase do clímax e, na conversão, 2 links e o rodapé.
    expect(await texts.count(), 'o seletor tem de achar o texto de todas as cenas').toBe(25);

    const opacities = await texts.evaluateAll((elements) =>
      elements.map((element) => {
        let opacity = 1;
        for (let node: Element | null = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
        return [element.textContent?.trim().slice(0, 40) ?? '', opacity] as const;
      }),
    );
    expect(opacities.filter(([, opacity]) => opacity !== 1)).toEqual([]);

    // A abertura não anima: o traço de luz (o 2º caminho do arco) está inteiro desde o primeiro quadro (dashoffset 0).
    const light = page.locator('[data-scene="1"] svg[data-arc] path').nth(1);
    expect(parseFloat(await light.evaluate((path) => getComputedStyle(path).strokeDashoffset))).toBe(0);
  });
});
