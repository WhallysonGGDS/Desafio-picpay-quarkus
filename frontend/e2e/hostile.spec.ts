import { expect, test } from '@playwright/test';
import { resetStub, stubCalls } from './support/stub';
import { newIdentity, newUser, signIn } from './support/users';

// Entradas hostis, no navegador, contra o artefato empacotado: o que vem da URL, do teclado e do clique nunca pode tirar a pessoa
// do app, mexer em dinheiro por engano ou enviar duas vezes. Cada caso tem um teste de unidade; aqui é o navegador de verdade.
const APP = 'http://localhost:8080';

test.beforeEach(async () => {
  await resetStub();
});

// O `?next=` do login vem da URL, ou seja, de quem a montou: aceitar qualquer coisa seria um redirecionamento aberto (a pessoa
// autentica e cai no site de outra pessoa).
const HOSTILE_NEXT: [string, string | null][] = [
  ['//evil.com', '/carteira'],
  ['/\\evil.com', '/carteira'],
  ['https://evil.com/x', '/carteira'],
  ['javascript:alert(1)', '/carteira'],
  ['/\t/evil.com', '/carteira'],
  // Começa com uma barra só e é um caminho do próprio app (que não existe): fica na origem, na tela de página não encontrada.
  ['/%2F/evil.com', null],
];

for (const [next, landing] of HOSTILE_NEXT) {
  test(`login com next=${JSON.stringify(next)} não sai da origem`, async ({ page, request }) => {
    const user = await newUser(request);
    const origins = new Set<string>();
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) origins.add(new URL(frame.url()).origin);
    });

    await page.goto(`/entrar?next=${encodeURIComponent(next)}`);
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Senha').fill(user.password);
    await page.getByRole('button', { name: 'Entrar na carteira' }).click();

    await page.waitForURL((url) => !url.pathname.startsWith('/entrar'));
    expect(new URL(page.url()).origin).toBe(APP);
    if (landing) expect(new URL(page.url()).pathname).toBe(landing);
    expect([...origins]).toEqual([APP]);
  });
}

// Quem já está logado e abre o link armado também não é levado para fora.
test('já logado, /entrar?next=//evil.com leva à carteira', async ({ page, request }) => {
  await signIn(page, await newUser(request));

  await page.goto(`/entrar?next=${encodeURIComponent('//evil.com')}`);

  await expect(page).toHaveURL('/carteira');
});

// O valor digitado vira dinheiro. Na dúvida, recusa: um "1,234" que virasse R$ 1,23 ou um "0.500" que virasse R$ 500 seria pior
// do que pedir para digitar de novo. Nada disto pode habilitar o "Revisar envio".
test('valores hostis ou ambíguos nunca deixam avançar', async ({ page, request }) => {
  await signIn(page, await newUser(request));
  await page.goto('/transferir');
  await page.getByLabel('E-mail ou CPF/CNPJ').fill('rafael@arco.demo');
  await page.getByRole('button', { name: /Rafael Costa/ }).click();
  await expect(page.getByRole('heading', { name: 'Quanto?' })).toBeFocused();
  const amount = page.getByLabel('Valor em reais');
  const next = page.getByRole('button', { name: 'Revisar envio' });

  // notação científica, milésimos, algarismo árabe e de largura total, negativo, zero, letras, vírgulas demais, ambíguos
  for (const text of ['1e3', '0,001', '٣', '１２３', '-5', '0', '0,00', 'abc', '1,2,3', '1.0000', '0.500', '1,234', ' ', 'R$']) {
    await amount.fill(text);
    await expect(next, `valor ${JSON.stringify(text)}`).toBeDisabled();
    await expect(page.getByText(/^Saldo depois/), `valor ${JSON.stringify(text)}`).toHaveCount(0);
  }

  // O mesmo campo, com um valor de verdade, libera: o teste não está só recusando tudo.
  await amount.fill('12,5');
  await expect(page.getByText(/^Saldo depois/)).toHaveText('Saldo depois R$ 987,50');
  await expect(next).toBeEnabled();
});

// O documento é validado por dígito verificador, e letras não são documento.
test('CPF com letras é recusado na tela, sem chamar o servidor', async ({ page }) => {
  const user = newIdentity();
  let registrations = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/auth/register') && request.method() === 'POST') registrations += 1;
  });
  await page.goto('/criar-conta');
  await page.getByLabel('Nome', { exact: true }).fill(user.firstName);
  await page.getByLabel('Sobrenome').fill(user.lastName);
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('CPF').fill('529.982.247-2A');
  await page.getByLabel('Senha').fill(user.password);

  await page.getByRole('button', { name: 'Criar minha carteira' }).click();

  await expect(page.getByLabel('CPF')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('alert')).toContainText('Documento inválido.');
  await expect(page).toHaveURL('/criar-conta');
  expect(registrations).toBe(0);
});

// Três cliques rápidos em "Enviar": o dinheiro sai uma vez. O botão se desabilita no primeiro, mas dois cliques podem chegar antes
// de o navegador redesenhar: a guarda síncrona é o que segura.
test('três cliques rápidos em "Enviar" enviam uma vez só', async ({ page, request }) => {
  await signIn(page, await newUser(request));
  let posts = 0;
  await page.route('**/transaction', (route) => {
    if (route.request().method() === 'POST') posts += 1;
    return route.continue();
  });
  await page.goto('/transferir');
  await page.getByLabel('E-mail ou CPF/CNPJ').fill('rafael@arco.demo');
  await page.getByRole('button', { name: /Rafael Costa/ }).click();
  await page.getByLabel('Valor em reais').fill('100');
  await page.getByRole('button', { name: 'Revisar envio' }).click();
  await expect(page.getByRole('heading', { name: 'Confirmar.' })).toBeVisible();

  await page.getByRole('button', { name: 'Enviar R$ 100,00 para Rafael Costa' }).click({ clickCount: 3, delay: 10 });

  await expect(page.getByRole('heading', { name: 'Enviado.' })).toBeVisible();
  expect(posts).toBe(1);
  expect((await stubCalls()).authorize).toBe(1);
  const me = (await (await page.request.get('/users/me')).json()) as { balance: string };
  expect(me.balance).toBe('900.00');
});
