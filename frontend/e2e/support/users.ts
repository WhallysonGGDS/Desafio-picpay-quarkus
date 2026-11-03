import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { cnpjFrom, cpfFrom } from './documents';

export type UserType = 'COMMON' | 'MERCHANT';

export interface Credentials {
  email: string;
  password: string;
}

export interface Identity extends Credentials {
  firstName: string;
  lastName: string;
  document: string;
  type: UserType;
}

/** As contas de demonstração do seed (ligado com -Dapp.seed.enabled=true), todas com a senha demo1234. */
export const DEMO = {
  marina: { email: 'marina@arco.demo', password: 'demo1234' },
  rafael: { email: 'rafael@arco.demo', password: 'demo1234' },
  loja: { email: 'loja@arco.demo', password: 'demo1234' },
} satisfies Record<string, Credentials>;

let counter = 0;

/**
 * Uma identidade nova, com e-mail e documento válidos e únicos. A semente vem do relógio e de um contador: não repete
 * dentro da execução nem contra um servidor que ficou de pé de uma execução anterior (o H2 guarda as contas até ele cair).
 */
export function newIdentity({ type = 'COMMON' }: { type?: UserType } = {}): Identity {
  counter += 1;
  const seed = (Date.now() % 90_000_000) + counter;
  return {
    firstName: type === 'MERCHANT' ? 'Loja' : 'Teste',
    lastName: `Ponta a Ponta ${seed}`,
    email: `e2e-${seed}@arco.test`,
    password: 'senha-de-teste-123',
    document: type === 'MERCHANT' ? cnpjFrom(seed) : cpfFrom(seed),
    type,
  };
}

/** Cadastra uma conta nova pela API (o saldo inicial é o de qualquer cadastro) e devolve como entrar nela. */
export async function newUser(request: APIRequestContext, options: { type?: UserType } = {}): Promise<Identity> {
  const identity = newIdentity(options);
  const response = await request.post('/auth/register', {
    data: {
      firstName: identity.firstName,
      lastName: identity.lastName,
      document: identity.document,
      email: identity.email,
      password: identity.password,
      userType: identity.type,
    },
  });
  expect(response.status(), `cadastro de ${identity.email}: ${await response.text()}`).toBe(201);
  return identity;
}

/** Entra pela API, no contexto do navegador da página: o cookie de sessão fica com ela, sem passar pela tela de login. */
export async function signIn(page: Page, credentials: Credentials): Promise<void> {
  const response = await page.request.post('/auth/login', {
    data: { email: credentials.email, password: credentials.password },
  });
  expect(response.status(), `login de ${credentials.email}: ${await response.text()}`).toBe(200);
}
