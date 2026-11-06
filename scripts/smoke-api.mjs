#!/usr/bin/env node
// Smoke test de ponta a ponta da API do Arco, contra o app empacotado e o stub dos serviços externos.
//
//   node scripts/stub-externals.mjs &
//   java -Dapp.seed.enabled=true -Dapp.jwt.cookie-secure=false \
//     -Dquarkus.rest-client.authorizer.url=http://localhost:9000 \
//     -Dquarkus.rest-client.notifier.url=http://localhost:9000 \
//     -jar target/quarkus-app/quarkus-run.jar &
//   node scripts/smoke-api.mjs
//
// Variáveis: BASE_URL (padrão http://localhost:8080) e STUB_URL (padrão http://localhost:9000).
// Imprime "✔ <passo>" por verificação e "SMOKE OK" no fim (código 0). Qualquer falha imprime o passo e sai com código 1.
// Pode rodar várias vezes contra a mesma instância: os saldos são comparados com o saldo inicial lido,
// não com valores fixos. Dinheiro é string; as contas usam centavos inteiros (nunca ponto flutuante).

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8080';
const STUB_URL = process.env.STUB_URL ?? 'http://localhost:9000';
const SESSION_COOKIE = 'arco_session';
const AMOUNT = '250.00';

function fail(step, detail) {
  console.error(`✘ ${step}\n  ${detail}`);
  process.exit(1);
}

function check(condition, step, detail) {
  if (!condition) fail(step, detail);
  console.log(`✔ ${step}`);
}

const toCents = (money) => BigInt(money.replace('.', ''));
const formatCents = (cents) => `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;

async function api(path, { method = 'GET', body, cookie } = {}) {
  const headers = {};
  if (cookie) headers.cookie = `${SESSION_COOKIE}=${cookie}`;
  // Toda rota POST exige JSON, inclusive o logout, que não tem corpo.
  if (method === 'POST') headers['content-type'] = 'application/json';
  const response = await fetch(BASE_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // corpo que não é JSON: json fica nulo e a verificação do passo acusa
  }
  return { status: response.status, json, setCookie: response.headers.getSetCookie() };
}

function sessionOf(response) {
  const raw = response.setCookie.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return raw?.split(';')[0].slice(SESSION_COOKIE.length + 1);
}

async function stub(path, method = 'GET', body) {
  const response = await fetch(STUB_URL + path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function login(email) {
  const response = await api('/auth/login', { method: 'POST', body: { email, password: 'demo1234' } });
  return { response, cookie: sessionOf(response) };
}

async function main() {
  // 1. Login da Marina
  const marina = await login('marina@arco.demo');
  check(marina.response.status === 200 && marina.cookie, 'login da Marina devolve 200 e o cookie de sessão',
    `status ${marina.response.status}, corpo ${JSON.stringify(marina.response.json)}`);

  // 2. Perfil e saldo inicial
  const me = await api('/users/me', { cookie: marina.cookie });
  const startCents = toCents(me.json?.balance ?? '0.00');
  check(me.status === 200 && /^\d+\.\d{2}$/.test(me.json?.balance ?? ''), `/users/me mostra o saldo como string com 2 casas (${me.json?.balance})`,
    `status ${me.status}, corpo ${JSON.stringify(me.json)}`);
  if (startCents < toCents(AMOUNT)) fail('saldo da Marina insuficiente para o smoke', 'Reinicie o app: o saldo de demonstração acabou.');

  // 3. Busca do destinatário
  const search = await api('/users/search?q=rafael@arco.demo', { cookie: marina.cookie });
  check(search.status === 200 && search.json?.length === 1 && search.json[0].firstName === 'Rafael',
    '/users/search?q=rafael@arco.demo devolve 1 item', `status ${search.status}, corpo ${JSON.stringify(search.json)}`);
  const rafaelId = search.json[0].id;

  // 4. Transferência autorizada
  await stub('/__reset', 'POST');
  const transfer = await api('/transaction', { method: 'POST', cookie: marina.cookie, body: { receiverId: rafaelId, amount: AMOUNT } });
  check(transfer.status === 201 && transfer.json?.amount === AMOUNT && transfer.json?.direction === 'SENT',
    `POST /transaction de ${AMOUNT} devolve 201`, `status ${transfer.status}, corpo ${JSON.stringify(transfer.json)}`);

  // 5. Saldo debitado
  const expectedAfter = formatCents(startCents - toCents(AMOUNT));
  const afterMe = await api('/users/me', { cookie: marina.cookie });
  check(afterMe.json?.balance === expectedAfter, `saldo da Marina caiu para ${expectedAfter}`, `saldo atual ${afterMe.json?.balance}`);

  // 6. Extrato
  const statement = await api('/transaction', { cookie: marina.cookie });
  check(statement.status === 200 && statement.json?.total >= 1 && statement.json?.items?.[0]?.direction === 'SENT',
    'extrato lista a transferência como SENT no topo', `status ${statement.status}, corpo ${JSON.stringify(statement.json)}`);

  // 7. Avisos enviados depois do commit, com e-mail e mensagem, e status SENT no extrato
  const expected = [
    { email: 'marina@arco.demo', mensagem: 'Você enviou R$ 250,00 para Rafael Costa.' },
    { email: 'rafael@arco.demo', mensagem: 'Você recebeu R$ 250,00 de Marina Alves.' },
  ];
  let calls = { notify: [] };
  let notified = false;
  for (let i = 0; i < 30 && !notified; i += 1) {
    calls = await stub('/__calls');
    notified = JSON.stringify(calls.notify) === JSON.stringify(expected);
    if (!notified) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  check(notified, 'os dois avisos chegaram ao notificador, em ordem, com e-mail e mensagem', `recebido: ${JSON.stringify(calls.notify)}`);
  let sent = false;
  for (let i = 0; i < 30 && !sent; i += 1) {
    const latest = await api('/transaction', { cookie: marina.cookie });
    sent = latest.json?.items?.[0]?.notifySender === 'SENT' && latest.json?.items?.[0]?.notifyReceiver === 'SENT';
    if (!sent) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  check(sent, 'o extrato mostra os dois avisos como SENT', 'os status não saíram de PENDING em 3 s');

  // 8. Autorizador recusa
  await stub('/__mode', 'POST', { authorize: 'deny' });
  const denied = await api('/transaction', { method: 'POST', cookie: marina.cookie, body: { receiverId: rafaelId, amount: AMOUNT } });
  const afterDenied = await api('/users/me', { cookie: marina.cookie });
  check(denied.status === 422 && denied.json?.code === 'AUTHORIZATION_DENIED' && afterDenied.json?.balance === expectedAfter,
    'autorizador recusa: 422 AUTHORIZATION_DENIED e o saldo não muda', `status ${denied.status}, corpo ${JSON.stringify(denied.json)}, saldo ${afterDenied.json?.balance}`);

  // 9. Autorizador fora do ar
  await stub('/__mode', 'POST', { authorize: 'down' });
  const down = await api('/transaction', { method: 'POST', cookie: marina.cookie, body: { receiverId: rafaelId, amount: AMOUNT } });
  check(down.status === 503 && down.json?.code === 'AUTHORIZER_UNAVAILABLE', 'autorizador fora do ar: 503 AUTHORIZER_UNAVAILABLE',
    `status ${down.status}, corpo ${JSON.stringify(down.json)}`);
  await stub('/__mode', 'POST', { authorize: 'grant' });

  // 10. Lojista não envia
  const shop = await login('loja@arco.demo');
  const merchant = await api('/transaction', { method: 'POST', cookie: shop.cookie, body: { receiverId: rafaelId, amount: '1.00' } });
  check(merchant.status === 403 && merchant.json?.code === 'MERCHANT_CANNOT_SEND', 'lojista não envia: 403 MERCHANT_CANNOT_SEND',
    `status ${merchant.status}, corpo ${JSON.stringify(merchant.json)}`);

  // 11. Logout
  const logout = await api('/auth/logout', { method: 'POST', cookie: marina.cookie });
  check(logout.status === 204 && logout.setCookie.some((c) => c.includes('Max-Age=0')), 'logout devolve 204 e expira o cookie',
    `status ${logout.status}, cookies ${JSON.stringify(logout.setCookie)}`);

  // 12. Sem sessão
  const anonymous = await api('/users/me');
  check(anonymous.status === 401 && anonymous.json?.code === 'UNAUTHENTICATED', 'sem cookie: 401 UNAUTHENTICATED',
    `status ${anonymous.status}, corpo ${JSON.stringify(anonymous.json)}`);

  console.log('SMOKE OK');
}

main().catch((error) => fail('erro inesperado', `${error.message}${error.cause ? ` (${error.cause.code ?? error.cause.message})` : ''}`));
