// As rotas do app. Nenhuma pode coincidir com um prefixo da API (/auth, /users, /transaction, /hello, /q):
// o back-end serve a API e o front na mesma origem, e routes.test.ts confere isso.
export const ROUTES = {
  home: '/',
  login: '/entrar',
  register: '/criar-conta',
  wallet: '/carteira',
  transfer: '/transferir',
  statement: '/extrato',
} as const;
