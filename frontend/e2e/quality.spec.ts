import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './support/axe';
import { collectConsoleErrors } from './support/console';
import { scrollToScene } from './support/scroll';
import { shot } from './support/shot';
import { resetStub } from './support/stub';
import { DEMO, newIdentity, newUser, signIn } from './support/users';

// A última é uma rota que não existe: a tela 404 também é uma tela do app.
const PUBLIC = ['/', '/entrar', '/criar-conta', '/rota-que-nao-existe'] as const;
const PRIVATE = ['/carteira', '/transferir', '/extrato'] as const;

/**
 * A tela montou, as fontes carregaram e nenhuma animação está a caminho: só então o que se mede é o que a pessoa vê
 * parada (uma medida no meio de uma entrada pega texto a meia opacidade e dá contraste falso).
 */
async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => (document.getElementById('root')?.childElementCount ?? 0) > 0);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'));
}

/** Vai de /transferir ao fim dos três passos (sem enviar), parando em cada um para `visit`. */
async function walkTransfer(page: Page, visit: (step: 1 | 2 | 3) => Promise<void>): Promise<void> {
  await page.goto('/transferir');
  await expect(page.getByRole('heading', { name: 'Para quem?' })).toBeFocused();
  await settled(page);
  await visit(1);

  await page.getByLabel('E-mail ou CPF/CNPJ').fill('rafael@arco.demo');
  await page.getByRole('button', { name: /Rafael Costa/ }).click();
  await expect(page.getByRole('heading', { name: 'Quanto?' })).toBeFocused();
  await page.getByLabel('Valor em reais').fill('50');
  await expect(page.getByText(/^Saldo depois/)).toBeVisible();
  await settled(page);
  await visit(2);

  await page.getByRole('button', { name: 'Revisar envio' }).click();
  await expect(page.getByRole('heading', { name: 'Confirmar.' })).toBeFocused();
  await settled(page);
  await visit(3);
}

/**
 * Tudo o que ainda anima ou espera para animar: a duração (de transição ou animação) acima de 1 ms ou qualquer atraso, no
 * elemento e nos pseudo-elementos `::before` e `::after`. Com movimento reduzido a regra global zera as durações; o atraso
 * ela não zera, e uma entrada com atraso e `fill-mode` deixa o texto invisível enquanto espera.
 */
async function motionOffenders(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const seconds = (list: string) =>
      list.split(',').map((part) => {
        const value = part.trim();
        return value.endsWith('ms') ? parseFloat(value) / 1000 : parseFloat(value);
      });
    const offenders: string[] = [];
    const inspect = (element: Element, pseudo: string | null) => {
      const style = getComputedStyle(element, pseudo);
      const durations = [...seconds(style.transitionDuration), ...seconds(style.animationDuration)];
      const delays = [...seconds(style.transitionDelay), ...seconds(style.animationDelay)];
      if (durations.some((duration) => !(duration <= 0.001)) || delays.some((delay) => delay !== 0)) {
        const name = String(element.getAttribute('class') ?? '').split(' ')[0];
        offenders.push(`${element.tagName.toLowerCase()}${pseudo ?? ''}.${name}: duração ${durations.join('/')} s, atraso ${delays.join('/')} s`);
      }
    };
    for (const element of Array.from(document.querySelectorAll('*'))) {
      inspect(element, null);
      inspect(element, '::before');
      inspect(element, '::after');
    }
    return offenders.slice(0, 12);
  });
}

test.describe('acessibilidade (axe)', () => {
  for (const route of PUBLIC) {
    test(`público ${route}`, async ({ page }) => {
      await page.goto(route);
      await settled(page);
      await expectNoA11yViolations(page);
    });
  }

  for (const route of PRIVATE) {
    test(`logado ${route}`, async ({ page }) => {
      await signIn(page, DEMO.marina);
      await page.goto(route);
      await expect(page.getByRole('heading').first()).toBeVisible();
      await settled(page);
      await expectNoA11yViolations(page);
    });
  }

  test('transferir nos 3 passos', async ({ page }) => {
    await signIn(page, DEMO.marina);
    await walkTransfer(page, () => expectNoA11yViolations(page));
  });

  test.describe('vitrine com movimento reduzido', () => {
    test.use({ reducedMotion: 'reduce' });

    test('as seis cenas, todas à vista', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('[data-scene]')).toHaveCount(6);
      await settled(page);
      await expectNoA11yViolations(page);
    });
  });
});

// Movimento reduzido: nada anima em nenhuma tela, nem espera para animar.
test.describe('movimento reduzido: nada anima', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const route of PUBLIC) {
    test(`público ${route}`, async ({ page }) => {
      await page.goto(route);
      await settled(page);
      expect(await motionOffenders(page)).toEqual([]);
    });
  }

  for (const route of PRIVATE) {
    test(`logado ${route}`, async ({ page }) => {
      await signIn(page, DEMO.marina);
      await page.goto(route);
      await expect(page.getByRole('heading').first()).toBeVisible();
      await settled(page);
      expect(await motionOffenders(page)).toEqual([]);
    });
  }

  test('transferir nos 3 passos', async ({ page }) => {
    await signIn(page, DEMO.marina);
    await walkTransfer(page, async (step) => {
      expect(await motionOffenders(page), `passo ${step}`).toEqual([]);
    });
  });
});

// Janela baixa (celular deitado): uma cena fixada tem a altura da janela, e o que passa dela some ou se sobrepõe. Em cada
// tamanho, com as cenas fixadas no fim do progresso (quando tudo está aceso), nenhum texto pode ficar cortado e dois textos
// nunca podem ocupar o mesmo lugar. Mede-se o texto de verdade (o retângulo de cada trecho): a caixa de um elemento pode
// passar da cena sem que nenhuma letra passe.
test('nenhum texto da vitrine fica cortado nem por cima de outro, em nenhum tamanho de janela', async ({ page }) => {
  test.setTimeout(180_000);
  const sizes = [
    [320, 568],
    [360, 640],
    [390, 844],
    [667, 375],
    [740, 360],
    [844, 390],
    [896, 414],
    [932, 430],
    [800, 480],
    [1024, 500],
    [1280, 520],
    [1440, 540],
    [700, 560],
    [800, 600],
    [900, 640],
    [1000, 600],
    [1024, 600],
    [600, 520],
    [768, 1024],
    [1024, 768],
    [1366, 768],
    [1440, 600],
    // A faixa estreita e de altura média: com o arco horizontal os dois textos do meio da cena 2 se tocavam ("…aconteceUm serviço…";
    // o servidor de CI, com a fonte um pouco mais larga, reprovou em 800×600). 600×600 e 700×650 são da janela compacta quadrada;
    // 760×600 e 820×600 seguem fixadas e precisam de folga. Os pares em volta das fronteiras (736 e 737 de largura, 768 e 769 de
    // altura, a janela quadrada e a em pé) mostram que a regra não deixa uma janela de fora.
    [600, 600],
    [700, 650],
    [760, 600],
    [820, 600],
    [992, 576],
    [993, 576],
    [992, 577],
    [736, 720],
    [737, 720],
    [736, 769],
    [735, 737],
  ] as const;

  const problems = (id: number) =>
    page.evaluate((sceneId) => {
      const scene = document.querySelector(`[data-scene="${sceneId}"]`) as HTMLElement;
      const box = scene.getBoundingClientRect();
      const items: { node: Node; text: string; rect: DOMRect }[] = [];
      const walker = document.createTreeWalker(scene, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent?.trim() ?? '';
        // O texto só para leitor de tela não ocupa lugar; o ponto e a vírgula do saldo recuam de propósito para os algarismos (a caixa
        // deles entra na dos vizinhos, a tinta não): são do Money, e o teste do Money os cobre.
        if (!text || node.parentElement?.closest('.sr-only, [data-separator]')) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of Array.from(range.getClientRects())) if (rect.width > 1 && rect.height > 1) items.push({ node, text, rect });
      }

      const found: string[] = [];
      for (const { text, rect } of items) {
        if (rect.right > box.right + 1 || rect.left < box.left - 1 || rect.bottom > box.bottom + 1 || rect.top < box.top - 1) {
          found.push(`cortado: "${text.slice(0, 28)}" em x ${Math.round(rect.left)}..${Math.round(rect.right)}, y ${Math.round(rect.top)}..${Math.round(rect.bottom)}, cena ${Math.round(box.width)}×${Math.round(box.height)}`);
        }
      }
      for (let i = 0; i < items.length; i += 1) {
        for (let j = i + 1; j < items.length; j += 1) {
          const a = items[i]!;
          const b = items[j]!;
          if (a.node === b.node) continue; // as linhas de um mesmo parágrafo se tocam por causa do line-height
          const width = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
          const height = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
          if (width > 4 && height > 0.3 * Math.min(a.rect.height, b.rect.height)) {
            // A mensagem leva a geometria e o ambiente: uma sobreposição que só aparece num computador (o servidor de CI, por exemplo)
            // precisa dizer onde os textos estão, que fonte usam e quanta largura a janela tem, porque o relatório é tudo o que há.
            const box = (rect: DOMRect) => `[${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}×${Math.round(rect.height)}]`;
            const font = (node: Node) => {
              const style = getComputedStyle(node.parentElement as Element);
              return `${style.fontFamily.split(',')[0]} ${style.fontSize}`;
            };
            const loaded = Array.from(document.fonts).filter((face) => face.status !== 'unloaded').map((face) => `${face.family.replace(/"/g, '')}:${face.status}`);
            found.push(
              `sobreposto: "${a.text.slice(0, 24)}" × "${b.text.slice(0, 24)}" | ${box(a.rect)} ${font(a.node)} × ${box(b.rect)} ${font(b.node)} | janela ${innerWidth}×${innerHeight}, ` +
                `barra de rolagem ${innerWidth - document.documentElement.clientWidth}px, dpr ${devicePixelRatio} | fontes ${loaded.join(' ')}`,
            );
          }
        }
      }
      return found.slice(0, 8);
    }, id);

  const failures: string[] = [];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.locator('[data-scene]')).toHaveCount(6);
    await page.evaluate(() => document.fonts.ready);
    for (const id of [2, 3]) {
      await scrollToScene(page, id, 1);
      for (const problem of await problems(id)) failures.push(`${width}×${height}, cena ${id}: ${problem}`);
      // A cena inteira (numa janela compacta ela é mais alta que a janela e rola com a página), para a revisão visual.
      if (width === 844) {
        await page.locator(`[data-scene="${id}"]`).screenshot({ path: `e2e/__screenshots__/${test.info().project.name}/qualidade-844x390-cena-${id}.png` });
      }
    }
  }
  expect(failures).toEqual([]);
});

// Janela em que as cenas fixadas não cabem (celular deitado, janela baixa, janela pequena e quadrada): é estreita e baixa demais
// para as quatro decisões da cena 2 (o texto de uma passava por cima do de outra). O motor não as prende: ficam em fluxo, no estado
// final, sem o scroll. Girando o celular, a vitrine se refaz.
test('em janela compacta as cenas 2 e 3 não prendem e já mostram o fim', async ({ page }) => {
  // O celular deitado, o limite de cima da faixa baixa (992×576) e a faixa estreita e quadrada (600×600 e o limite 736×720).
  for (const [width, height] of [
    [844, 390],
    [992, 576],
    [600, 600],
    [736, 720],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.locator('[data-scene]')).toHaveCount(6);

    await expect(page.locator('.pin-spacer'), `${width}×${height}`).toHaveCount(0);
    await expect(page.locator('[data-scene="2"]')).toHaveAttribute('data-progress', '1.000');
    await expect(page.locator('[data-scene="3"]')).toHaveAttribute('data-progress', '1.000');
    await expect(page.getByTestId('wallet-balance')).toHaveText('R$ 750,00');
  }

  // Em pé, a janela deixa de ser compacta: as duas voltam a prender, e o saldo volta ao começo.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.pin-spacer')).toHaveCount(2);
  await expect(page.locator('[data-scene="3"]')).toHaveAttribute('data-progress', '0.000');
  await expect(page.getByTestId('wallet-balance')).toHaveText('R$ 1.000,00');
});

// A fronteira da regra: 1 px a mais de largura ou de altura e a janela comporta as cenas fixadas: elas prendem. O celular em pé
// (360×640, 375×667, 320×640...) tem pouca altura e muita gente o usa: ele NÃO é compacto, e perder as cenas fixadas ali foi o
// erro de uma primeira versão da regra. Sem isto a regra podia crescer e tirar a vitrine de um celular, de um notebook ou de um
// iPad deitado (1024×768) sem que nada reprovasse.
test('uma janela um pixel acima da fronteira, ou em pé, ainda prende as cenas 2 e 3', async ({ page }) => {
  for (const [width, height] of [
    [993, 576],
    [992, 577],
    [737, 720],
    [736, 769],
    [735, 737], // um pouco mais alta que larga: em pé, o arco é vertical e cabe
    [360, 640],
    [375, 667],
    [412, 740],
    [1024, 768],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.locator('[data-scene]')).toHaveCount(6);

    await expect(page.locator('.pin-spacer'), `${width}×${height}`).toHaveCount(2);
    await expect(page.locator('[data-scene="3"]')).toHaveAttribute('data-progress', '0.000');
  }
});

// RF5: em 320 px (o menor celular) nenhuma tela rola na horizontal.
test('nenhuma rota rola na horizontal a 320 px (RF5)', async ({ page }) => {
  test.setTimeout(90_000);
  // O teste envia dinheiro até "Enviado.": o autorizador do stub tem de aprovar, mesmo que o teste rode sozinho depois de outro que o
  // deixou recusando (--last-failed, -g).
  await resetStub();
  const WIDTH = 320;
  await page.setViewportSize({ width: WIDTH, height: 568 });
  // Compara com 320, não com `innerWidth`: na emulação de celular o navegador afasta o zoom para caber o que estoura, e
  // `innerWidth` cresce junto: a comparação com ele passaria sempre.
  const overflow = async (label: string) => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    if (scrollWidth <= WIDTH) return;
    const culprits = await page.evaluate((limit) => {
      return Array.from(document.querySelectorAll('body *'))
        .map((element) => ({ element, right: element.getBoundingClientRect().right }))
        .filter(({ right }) => right > limit + 0.5)
        .slice(0, 6)
        .map(({ element, right }) => `${element.tagName.toLowerCase()} "${(element.textContent ?? '').trim().slice(0, 36)}" até ${Math.round(right)} px`);
    }, WIDTH);
    expect(scrollWidth, `${label}: a página tem ${scrollWidth} px de largura. Estouram: ${culprits.join('; ')}`).toBeLessThanOrEqual(WIDTH);
  };

  for (const route of PUBLIC) {
    await page.goto(route);
    await settled(page);
    await overflow(route);
  }

  await signIn(page, DEMO.marina);
  for (const route of PRIVATE) {
    await page.goto(route);
    await expect(page.getByRole('heading').first()).toBeVisible();
    await settled(page);
    await overflow(route);
  }
  await walkTransfer(page, async (step) => {
    await overflow(`/transferir, passo ${step}`);
    if (step === 3) {
      await page.getByRole('button', { name: /^Enviar/ }).scrollIntoViewIfNeeded();
      await shot(page, 'qualidade-320-confirmar');
    }
  });

  // E a tela que fecha o envio, com a frase "R$ 50,00 para Rafael Costa." no tamanho de título.
  await page.getByRole('button', { name: /^Enviar R\$ 50,00 para Rafael Costa/ }).click();
  await expect(page.getByRole('heading', { name: 'Enviado.' })).toBeVisible();
  await settled(page);
  await overflow('/transferir, enviado');
  // A tela de resultado do envio não é um dos três passos: o axe também passa por ela.
  await expectNoA11yViolations(page);
});

// Foco visível (WCAG 2.2, 2.4.11): no celular a barra de navegação é fixa e fica por cima do fim da página; o navegador, ao
// focar um controle, o rola só até a borda da janela, que é onde a barra está. O último botão do envio não pode ficar atrás dela.
test('o foco nunca fica coberto pela barra inferior', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await signIn(page, DEMO.marina);

  await walkTransfer(page, async (step) => {
    if (step !== 3) return;
    await page.getByRole('button', { name: /^Enviar/ }).focus();
    const covered = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement;
      const box = element.getBoundingClientRect();
      // A borda de baixo do botão é a parte que a barra cobriria; o centro da borda tem de ser do próprio botão.
      const hit = document.elementFromPoint(box.left + box.width / 2, box.bottom - 2);
      return { covered: hit !== element && !element.contains(hit), by: hit?.tagName.toLowerCase() ?? 'nada', bottom: box.bottom, viewport: window.innerHeight };
    });
    expect(covered, 'o botão focado está sob outro elemento').toMatchObject({ covered: false });
  });
});

test('sem erros de console nem exceções durante a jornada completa', async ({ page }) => {
  test.setTimeout(90_000);
  await resetStub();
  const errors = collectConsoleErrors(page);
  const user = newIdentity();

  // A vitrine, do topo ao CTA.
  await page.goto('/');
  await expect(page.locator('[data-scene]')).toHaveCount(6);
  for (let step = 0; step < 12; step += 1) {
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(60);
  }
  await page.getByRole('link', { name: 'Abrir minha carteira' }).click();

  // Cadastro, carteira, envio, extrato e saída.
  await expect(page).toHaveURL('/criar-conta');
  await page.getByLabel('Nome', { exact: true }).fill(user.firstName);
  await page.getByLabel('Sobrenome').fill(user.lastName);
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('CPF').fill(user.document);
  await page.getByLabel('Senha').fill(user.password);
  await page.getByRole('button', { name: 'Criar minha carteira' }).click();
  await expect(page).toHaveURL('/carteira');
  await expect(page.getByTestId('wallet-balance')).toHaveText('R$ 1.000,00');

  await page.getByRole('link', { name: 'Enviar dinheiro' }).click();
  await page.getByLabel('E-mail ou CPF/CNPJ').fill('rafael@arco.demo');
  await page.getByRole('button', { name: /Rafael Costa/ }).click();
  await page.getByLabel('Valor em reais').fill('10');
  await page.getByRole('button', { name: 'Revisar envio' }).click();
  await page.getByRole('button', { name: 'Enviar R$ 10,00 para Rafael Costa' }).click();
  await expect(page.getByRole('heading', { name: 'Enviado.' })).toBeVisible();

  await page.getByRole('link', { name: 'Ver extrato' }).click();
  await expect(page).toHaveURL('/extrato');
  await expect(page.getByRole('list', { name: 'Tudo' }).getByRole('listitem').first()).toContainText('Rafael Costa');
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL('/entrar');

  expect(errors()).toEqual([]);
});

// WCAG 2.4.2: cada tela tem o seu título. É o que a aba e o histórico mostram, e o que o leitor de tela lê quando um app de uma
// página só troca de tela.
test('cada tela tem o seu título', async ({ page }) => {
  const expected: Record<string, string> = {
    '/': 'Arco',
    '/entrar': 'Entrar na carteira | Arco',
    '/criar-conta': 'Criar minha carteira | Arco',
    '/rota-que-nao-existe': 'Página não encontrada | Arco',
    '/carteira': 'Carteira | Arco',
    '/transferir': 'Transferir | Arco',
    '/extrato': 'Extrato | Arco',
  };
  for (const route of PUBLIC) {
    await page.goto(route);
    await expect(page, route).toHaveTitle(expected[route] as string);
  }
  await signIn(page, DEMO.marina);
  for (const route of PRIVATE) {
    await page.goto(route);
    await expect(page, route).toHaveTitle(expected[route] as string);
  }
});

// A aba do navegador mostra a marca (e não o ícone genérico de página), e a página se descreve ao ser compartilhada.
test('a aba tem o ícone da marca e a página tem descrição', async ({ page, request }) => {
  await page.goto('/entrar');

  const icon = page.locator('link[rel="icon"]');
  await expect(icon).toHaveCount(1);
  const response = await request.get((await icon.getAttribute('href')) ?? '/sem-icone');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/svg+xml');

  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description ?? '').toMatch(/transfer/i);
});

// A carteira de quem acaba de se cadastrar (é a primeira tela que cada pessoa vê): a frase do vazio nasce na altura do rótulo
// "Saldo", e não uns 20 px abaixo, flutuando sem alinhar com nada. Mede-se o TEXTO (o retângulo das letras), não a caixa do
// elemento: o deslocamento estava no padding de dentro da caixa, que começava na mesma altura.
test('carteira vazia: a frase do vazio alinha com o rótulo "Saldo"', async ({ page, request }) => {
  test.skip(test.info().project.name !== 'desktop', 'as duas colunas só existem em janela larga');
  await signIn(page, await newUser(request));
  await page.goto('/carteira');
  const message = page.getByText('Nenhuma movimentação por aqui.');
  await expect(message).toBeVisible();

  const textTop = (locator: typeof message) =>
    locator.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getBoundingClientRect().top;
    });
  const label = await textTop(page.getByText('Saldo', { exact: true }));
  const phrase = await textTop(message);

  expect(Math.abs(phrase - label), `o rótulo começa em y=${label} e a frase em y=${phrase}`).toBeLessThanOrEqual(4);
});

test('as fontes Geist carregam da própria origem e nada externo é requisitado', async ({ page }) => {
  const origins = new Set<string>();
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) origins.add(new URL(request.url()).origin);
  });

  await signIn(page, DEMO.marina);
  await page.goto('/carteira');
  await expect(page.getByTestId('wallet-balance')).toBeVisible();

  // `document.fonts.check` devolve true até para família que nem foi declarada: o que vale é o status de cada FontFace.
  const faces = await page.evaluate(async () => {
    await document.fonts.ready;
    return Array.from(document.fonts).map((face) => ({ family: face.family.replace(/["']/g, ''), status: face.status }));
  });
  const loaded = (family: string) => faces.some((face) => face.family === family && face.status === 'loaded');
  expect(loaded('Geist Variable'), JSON.stringify(faces)).toBe(true);
  expect(loaded('Geist Mono Variable'), JSON.stringify(faces)).toBe(true);
  expect([...origins]).toEqual(['http://localhost:8080']);
});

// Política de segurança do conteúdo (CSP). Em produção o servidor a manda (o SpaServingIT confere o texto dos cabeçalhos, no jar);
// aqui se prova, no navegador, as duas pontas: que ela é aplicada (o que ela proíbe de fato não roda) e que o app inteiro cabe
// nela (nenhuma tela provoca violação). Só a primeira ponta aprovaria uma política que não protege nada; só a segunda, um
// cabeçalho que ninguém mais confere.
type WatchedWindow = Window & { __violations: string[]; __ran?: boolean };

/** Guarda, dentro da página e antes de qualquer script dela, cada violação que o navegador reportar no documento atual. */
async function watchViolations(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as WatchedWindow).__violations = seen;
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(`${event.violatedDirective} barrou ${event.blockedURI || 'código embutido'}`);
    });
  });
  // Lê e esvazia: cada leitura devolve só o que aconteceu desde a anterior.
  return () => page.evaluate(() => (window as unknown as WatchedWindow).__violations.splice(0));
}

test.describe('política de segurança do conteúdo (CSP)', () => {
  test('a política é aplicada: script embutido, eval, estilo embutido e conexão a outra origem são barrados', async ({ page }) => {
    const violations = await watchViolations(page);
    await page.goto('/entrar');
    await settled(page);

    const outcome = await page.evaluate(async () => {
      const script = document.createElement('script');
      script.textContent = 'window.__ran = true';
      document.head.append(script);

      // O eval roda num cronômetro, e não aqui: o que o `page.evaluate` executa, o inspetor do navegador libera do eval.
      const evalOutcome = new Promise<string>((resolve) =>
        setTimeout(() => {
          try {
            new Function('return 1')();
            resolve('não barrou');
          } catch (error) {
            resolve((error as Error).name);
          }
        }, 0),
      );

      const probe = document.createElement('p');
      probe.textContent = 'sonda';
      probe.setAttribute('style', 'color: rgb(255, 0, 0)');
      document.body.append(probe);
      const styled = getComputedStyle(probe).color === 'rgb(255, 0, 0)';

      // O resultado do fetch não prova nada (o nome não resolve com ou sem política): quem prova é a violação reportada.
      await fetch('https://exemplo.invalid/', { mode: 'no-cors' }).catch(() => undefined);
      return { scriptRan: Boolean((window as unknown as WatchedWindow).__ran), evalError: await evalOutcome, styled };
    });

    expect(outcome).toEqual({ scriptRan: false, evalError: 'EvalError', styled: false });
    const directives = (await violations()).map((violation) => violation.split(' ')[0]);
    expect(new Set(directives)).toEqual(new Set(['script-src-elem', 'script-src', 'style-src-attr', 'connect-src']));
  });

  // Clickjacking: a tela de envio tem um botão que move dinheiro. Nem a própria origem pode enquadrá-la.
  test('ninguém enquadra o app, nem a própria origem', async ({ page }) => {
    await page.goto('/entrar');
    await settled(page);
    const framed = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const frame = document.createElement('iframe');
          frame.src = '/entrar';
          // Um quadro bloqueado carrega uma página de erro de outra origem: o documento dele não é legível.
          frame.addEventListener('load', () => resolve(frame.contentDocument !== null));
          document.body.append(frame);
        }),
    );
    expect(framed).toBe(false);
  });

  test('o app inteiro roda sob a política, sem nenhuma violação', async ({ page, request }) => {
    test.setTimeout(90_000);
    await resetStub();
    const user = await newUser(request);
    const violations = await watchViolations(page);
    const found: string[] = [];
    const check = async (where: string) => {
      for (const violation of await violations()) found.push(`${where}: ${violation}`);
    };

    // A vitrine, do topo ao fim: é onde o GSAP, o Lenis e o ScrollTrigger mexem nos estilos.
    await page.goto('/');
    await expect(page.locator('[data-scene]')).toHaveCount(6);
    for (let step = 0; step < 12; step += 1) {
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(60);
    }
    await check('vitrine');

    for (const route of ['/entrar', '/criar-conta']) {
      await page.goto(route);
      await settled(page);
      await check(route);
    }

    await signIn(page, user);
    for (const route of ['/carteira', '/extrato']) {
      await page.goto(route);
      await expect(page.getByRole('heading').first()).toBeVisible();
      await settled(page);
      await check(route);
    }

    await walkTransfer(page, (step) => check(`/transferir, passo ${step}`));
    await page.getByRole('button', { name: /^Enviar R\$ 50,00 para Rafael Costa/ }).click();
    await expect(page.getByRole('heading', { name: 'Enviado.' })).toBeVisible();
    await settled(page);
    await check('/transferir, enviado');

    expect(found).toEqual([]);
  });
});

// WCAG 2.4.3: num app de uma página só, trocar de tela não é uma navegação para o navegador, e ele não move o foco nem a rolagem.
// O foco ficaria no link da nav (ou no corpo da página, se o botão clicado saiu com a tela) e a tela nova abriria na altura da
// anterior. É o que RouteFocus corrige; aqui se confere no navegador, com teclado e com a vitrine rolada até o fim.
test.describe('ao trocar de tela', () => {
  test('o foco vai ao título da tela nova, e o Tab seguinte entra nela em vez de seguir da nav', async ({ page }) => {
    await signIn(page, DEMO.marina);
    await page.goto('/carteira');
    await expect(page.getByTestId('wallet-balance')).toBeVisible();
    // A primeira tela deixa o foco com o navegador: nada é roubado de quem acabou de abrir o app.
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

    // Pelo teclado, que é quando o anel de foco (:focus-visible) aparece: o título, focado por código, não pode ganhar um.
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Extrato' }).focus();
    await page.keyboard.press('Enter');
    const title = page.getByRole('heading', { level: 1, name: 'Extrato' });
    await expect(title).toBeFocused();
    expect(await title.evaluate((element) => getComputedStyle(element).outlineStyle), 'o título focado por código não leva anel').toBe('none');

    // O Tab seguinte é o primeiro controle da tela (a aba escolhida do extrato), e não o item seguinte da nav.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('tab', { name: 'Tudo' })).toBeFocused();
  });

  test('a tela nova abre no topo, mesmo vindo do fim da vitrine', async ({ page }) => {
    // Janela baixa: o cadastro é mais alto que ela, e é nessa altura que a rolagem da vitrine, se mantida, esconde o título.
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/');
    await expect(page.locator('[data-scene]')).toHaveCount(6);
    for (let step = 0; step < 14; step += 1) {
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(60);
    }
    expect(await page.evaluate(() => window.scrollY), 'a vitrine tem de estar rolada para o teste valer').toBeGreaterThan(1000);

    await page.getByRole('link', { name: 'Abrir minha carteira' }).click();
    await expect(page).toHaveURL('/criar-conta');

    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Criar minha carteira' })).toBeFocused();
  });
});
