import { expect, test, type Page } from '@playwright/test';
import { shot } from './support/shot';
import { resetStub, setStub, stubCalls } from './support/stub';
import { newUser, signIn } from './support/users';

// Serial: o stub dos serviços externos é um só, e cada teste o põe num modo.
test.describe.configure({ mode: 'serial' });

test.beforeEach(async () => {
  await resetStub();
});

/** Entra com uma conta nova (saldo R$ 1.000,00) e chega ao passo 3 de uma transferência de `amount` para o Rafael. */
async function reachConfirmation(page: Page, request: Parameters<typeof newUser>[0], amount: string) {
  await signIn(page, await newUser(request));
  await page.goto('/transferir');
  await page.getByLabel('E-mail ou CPF/CNPJ').fill('rafael@arco.demo');
  await page.getByRole('button', { name: /Rafael Costa/ }).click();
  await page.getByLabel('Valor em reais').fill(amount);
  await page.getByRole('button', { name: 'Revisar envio' }).click();
  await expect(page.getByRole('heading', { name: 'Confirmar.' })).toBeVisible();
}

const balance = async (page: Page) => ((await (await page.request.get('/users/me')).json()) as { balance: string }).balance;

test('autorizador recusa: mensagem, saldo intacto e sucesso ao tentar de novo', async ({ page, request }) => {
  await reachConfirmation(page, request, '250');
  await setStub({ authorize: 'deny' });

  await page.getByRole('button', { name: 'Enviar R$ 250,00 para Rafael Costa' }).click();

  await expect(page.getByText(/recusou/)).toBeVisible();
  await shot(page, '10-recusa-do-autorizador');
  // O foco é devolvido a quem usa teclado: o botão ocupado (desabilitado) o perdeu, e o "Tentar de novo" nasce com ele.
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeFocused();
  expect(await balance(page)).toBe('1000.00');

  await setStub({ authorize: 'grant' });
  await page.getByRole('button', { name: 'Tentar de novo' }).click();

  await expect(page.getByRole('heading', { name: 'Enviado.' })).toBeVisible();
  expect(await balance(page)).toBe('750.00');
});

test('autorizador fora do ar', async ({ page, request }) => {
  await reachConfirmation(page, request, '250');
  await setStub({ authorize: 'down' });

  await page.getByRole('button', { name: 'Enviar R$ 250,00 para Rafael Costa' }).click();

  await expect(page.getByText(/fora do ar/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  expect(await balance(page)).toBe('1000.00');
});

test('saldo insuficiente é barrado antes de enviar', async ({ page, request }) => {
  await signIn(page, await newUser(request));
  await page.goto('/transferir');
  await page.getByLabel('E-mail ou CPF/CNPJ').fill('rafael@arco.demo');
  await page.getByRole('button', { name: /Rafael Costa/ }).click();

  await page.getByLabel('Valor em reais').fill('5000');

  await expect(page.getByText('Saldo insuficiente para este valor.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revisar envio' })).toBeDisabled();
  await shot(page, '11-saldo-insuficiente');
  // O servidor nem chegou a ser consultado: o autorizador não recebeu pedido nenhum.
  expect((await stubCalls()).authorize).toBe(0);
});

test('sessão expira no meio do envio', async ({ page, request, context }) => {
  await reachConfirmation(page, request, '250');

  await context.clearCookies();
  await page.getByRole('button', { name: 'Enviar R$ 250,00 para Rafael Costa' }).click();

  await expect(page).toHaveURL('/entrar?next=%2Ftransferir');
  expect((await stubCalls()).authorize).toBe(0);
});

// A sessão dura 1 hora: ao vencer, qualquer tela que consulta o servidor (não só o envio) leva a pessoa a entrar de novo.
test('sessão expira com a pessoa na carteira: o extrato leva ao login', async ({ page, request, context }) => {
  await signIn(page, await newUser(request));
  await page.goto('/carteira');
  await expect(page.getByTestId('wallet-balance')).toBeVisible();

  await context.clearCookies();
  await page.getByRole('link', { name: 'Extrato', exact: true }).click();

  await expect(page).toHaveURL('/entrar?next=%2Fextrato');
  await expect(page.getByRole('heading', { name: 'Entrar na carteira' })).toBeVisible();
});

test('resultado desconhecido: sem reenvio', async ({ page, request }) => {
  await reachConfirmation(page, request, '250');
  let posts = 0;
  await page.route('**/transaction', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    posts += 1;
    return route.abort('failed');
  });

  await page.getByRole('button', { name: 'Enviar R$ 250,00 para Rafael Costa' }).click();

  await expect(page.getByText(/Não deu para confirmar/)).toBeVisible();
  await shot(page, '12-resultado-desconhecido');
  await expect(page.getByRole('button', { name: /tentar de novo|enviar/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Conferir extrato' })).toBeVisible();
  // Nada reenvia sozinho: um único pedido saiu, e dá tempo de sobra para uma repetição automática (1 s) aparecer.
  await page.waitForTimeout(1500);
  expect(posts).toBe(1);
});
