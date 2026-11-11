import { expect, test } from '@playwright/test';
import { shot } from './support/shot';
import { resetStub, stubCalls } from './support/stub';
import { DEMO, newIdentity, newUser, signIn } from './support/users';

test.beforeEach(async () => {
  await resetStub();
});

test('cadastro, envio, extrato e saída', async ({ page }) => {
  test.setTimeout(60_000);
  const user = newIdentity();

  // Cadastro pela tela: Pessoa, CPF com máscara, saldo de demonstração.
  await page.goto('/criar-conta');
  await expect(page.getByRole('heading', { name: 'Criar minha carteira' })).toBeVisible();
  await shot(page, '01-cadastro');
  await page.getByLabel('Nome', { exact: true }).fill(user.firstName);
  await page.getByLabel('Sobrenome').fill(user.lastName);
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('CPF').fill(user.document);
  await page.getByLabel('Senha').fill(user.password);
  await page.getByRole('button', { name: 'Criar minha carteira' }).click();

  await expect(page).toHaveURL('/carteira');
  await expect(page.getByTestId('wallet-balance')).toHaveText('R$ 1.000,00');
  await shot(page, '02-carteira');

  // Transferir: para quem, quanto, confirmar.
  await page.getByRole('link', { name: 'Enviar dinheiro' }).click();
  await expect(page.getByRole('heading', { name: 'Para quem?' })).toBeFocused();
  await page.getByLabel('E-mail ou CPF/CNPJ').fill('rafael@arco.demo');
  const recipient = page.getByRole('button', { name: /Rafael Costa/ });
  await expect(recipient).toBeVisible();
  await expect(recipient).toContainText('***.444.777-**');
  await shot(page, '03-transferir-1-para-quem');
  await recipient.click();

  await expect(page.getByRole('heading', { name: 'Quanto?' })).toBeFocused();
  await page.getByLabel('Valor em reais').fill('250');
  await expect(page.getByText(/^Saldo depois/)).toHaveText('Saldo depois R$ 750,00');
  await shot(page, '04-transferir-2-quanto');
  await page.getByRole('button', { name: 'Revisar envio' }).click();

  await expect(page.getByRole('heading', { name: 'Confirmar.' })).toBeFocused();
  await shot(page, '05-transferir-3-confirmar');
  await page.getByRole('button', { name: 'Enviar R$ 250,00 para Rafael Costa' }).click();

  await expect(page.getByRole('heading', { name: 'Enviado.' })).toBeVisible();
  await expect(page.getByText('R$ 250,00 para Rafael Costa.')).toBeVisible();
  // O arco leva ~640 ms para pousar e o ponto de chegada pulsa depois: a captura espera o movimento terminar.
  await page.waitForTimeout(1600);
  await shot(page, '06-enviado');

  // Extrato: a primeira linha é a transferência, com o sinal de saída.
  await page.getByRole('link', { name: 'Ver extrato' }).click();
  await expect(page).toHaveURL('/extrato');
  const first = page.getByRole('list', { name: 'Tudo' }).getByRole('listitem').first();
  await expect(first).toContainText('Rafael Costa');
  await expect(first).toContainText('−R$ 250,00');
  await shot(page, '07-extrato');

  // O saldo da carteira já é o novo.
  await page.getByRole('link', { name: 'Carteira', exact: true }).click();
  await expect(page.getByTestId('wallet-balance')).toHaveText('R$ 750,00');

  // Sair leva ao login, e a sessão acabou de verdade: a carteira pede entrar e lembra para onde voltar.
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL('/entrar');
  await page.goto('/carteira');
  await expect(page).toHaveURL('/entrar?next=%2Fcarteira');

  // O remetente e o destinatário foram avisados (o aviso sai depois do commit, sem travar a resposta).
  await expect.poll(async () => (await stubCalls()).notify.length, { timeout: 3_000 }).toBe(2);
});

// Os CNPJs com letras que a Receita emite desde julho de 2026: a loja se cadastra digitando o CNPJ como a pessoa o digita (sem pontuação, em
// minúsculas), o campo o põe em maiúsculas com a máscara, e quem quer enviar dinheiro a acha pelo CNPJ digitado de outro jeito (mascarado, em minúsculas).
test('loja com CNPJ alfanumérico: cadastro pela tela e envio achando-a pelo CNPJ', async ({ page, request }) => {
  test.setTimeout(60_000);
  const shop = newIdentity({ type: 'MERCHANT', alphanumeric: true });
  const sender = await newUser(request);
  const d = shop.document;
  const masked = `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  expect(d, 'o CNPJ do teste precisa ter letras').toMatch(/[A-Z]/);

  await page.goto('/criar-conta');
  // O botão de rádio é desenhado pelo texto que o cobre: quem clica é o texto, como a pessoa faz.
  await page.getByRole('group', { name: 'Eu sou' }).getByText('Loja', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Loja' })).toBeChecked();
  await page.getByLabel('Nome', { exact: true }).fill(shop.firstName);
  await page.getByLabel('Sobrenome').fill(shop.lastName);
  await page.getByLabel('E-mail').fill(shop.email);
  const cnpj = page.getByLabel('CNPJ');
  await cnpj.fill(d.toLowerCase());
  await expect(cnpj).toHaveValue(masked);
  await page.getByLabel('Senha').fill(shop.password);
  await shot(page, '10-cadastro-loja-cnpj-alfanumerico');
  await page.getByRole('button', { name: 'Criar minha carteira' }).click();
  await expect(page).toHaveURL('/carteira');
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL('/entrar');

  await signIn(page, sender);
  await page.goto('/transferir');
  await page.getByLabel('E-mail ou CPF/CNPJ').fill(masked.toLowerCase());
  const recipient = page.getByRole('button', { name: new RegExp(shop.lastName) });
  await expect(recipient).toBeVisible();
  await expect(recipient).toContainText(`**.${d.slice(2, 5)}.${d.slice(5, 8)}/****-**`);
  await recipient.click();

  await page.getByLabel('Valor em reais').fill('100');
  await page.getByRole('button', { name: 'Revisar envio' }).click();
  await page.getByRole('button', { name: `Enviar R$ 100,00 para ${shop.firstName} ${shop.lastName}` }).click();
  await expect(page.getByRole('heading', { name: 'Enviado.' })).toBeVisible();
  await expect(page.getByText(`R$ 100,00 para ${shop.firstName} ${shop.lastName}.`)).toBeVisible();
});

test('login pela interface volta ao destino pedido', async ({ page, request }) => {
  const user = await newUser(request);

  await page.goto('/transferir');
  await expect(page).toHaveURL('/entrar?next=%2Ftransferir');
  await expect(page.getByRole('heading', { name: 'Entrar na carteira' })).toBeVisible();
  await shot(page, '08-login');

  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Senha').fill('senha-errada');
  await page.getByRole('button', { name: 'Entrar na carteira' }).click();
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.');
  await expect(page).toHaveURL('/entrar?next=%2Ftransferir');

  await page.getByLabel('Senha').fill(user.password);
  await page.getByRole('button', { name: 'Entrar na carteira' }).click();
  await expect(page).toHaveURL('/transferir');
  await expect(page.getByRole('heading', { name: 'Para quem?' })).toBeVisible();
});

test('lojista não envia', async ({ page }) => {
  await signIn(page, DEMO.loja);

  await page.goto('/transferir');

  await expect(page.getByRole('heading', { name: 'Lojas recebem, não enviam.' })).toBeVisible();
  await expect(page.getByLabel('E-mail ou CPF/CNPJ')).toHaveCount(0);
  await shot(page, '09-lojista');
});
