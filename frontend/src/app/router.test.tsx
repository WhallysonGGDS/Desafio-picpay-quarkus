import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { errorResponse } from '../test/api';
import { marina } from '../test/fixtures';
import { sessionKey } from './session';
import { currentUrl, renderApp, renderRoutes } from '../test/render';
import { routes } from './router';
import type { RouteObject } from 'react-router-dom';
import { server } from '../test/server';

// A vitrine liga o Lenis e o ScrollTrigger, que precisam de layout, ResizeObserver e matchMedia: o jsdom não tem nada disso. Aqui só
// importa a rota (a raiz é pública e não redireciona). O motor tem teste próprio (useScrollScenes.test) e roda num navegador
// de verdade (e2e/showcase.spec).
vi.mock('../showcase/useScrollScenes', () => ({ useScrollScenes: () => undefined }));

const mainNav = () => screen.findByRole('navigation', { name: 'Principal' });

// O app inteiro, com as rotas reais e a API simulada (MSW).
describe('guarda de sessão', () => {
  // Quebra se: a tela privada abrir sem sessão, ou o destino pedido se perder no caminho do login (RF3).
  it('sem sessão, /transferir?x=1 vai para /entrar?next=%2Ftransferir%3Fx%3D1', async () => {
    const { router } = renderApp('/transferir?x=1');

    await waitFor(() => expect(currentUrl(router)).toBe('/entrar?next=%2Ftransferir%3Fx%3D1'));
    expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull();
  });

  // Quebra se: a guarda decidir antes de a sessão responder (redirecionar quem está logado, ou piscar a tela privada).
  it('enquanto a sessão carrega, não redireciona nem mostra a tela privada', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('*/users/me', async () => {
        await gate;
        return HttpResponse.json(marina);
      }),
    );
    const { router } = renderRoutes('/transferir');

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(currentUrl(router)).toBe('/transferir');
    expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull();
    expect(screen.getByText('Carregando…')).toBeInTheDocument();

    release();
    await mainNav();
    expect(currentUrl(router)).toBe('/transferir');
  });

  // Quebra se: a falha ao consultar a sessão mandar ao login (a pessoa pode estar logada) em vez de dizer o que houve.
  it('se a sessão não pôde ser consultada, mostra o motivo com "Tentar de novo" e não redireciona', async () => {
    server.use(http.get('*/users/me', () => HttpResponse.error()));
    const { router } = renderRoutes('/carteira');

    const retry = await screen.findByRole('button', { name: 'Tentar de novo' });
    expect(screen.getByRole('alert')).toHaveTextContent('Sem conexão com o servidor.');
    expect(currentUrl(router)).toBe('/carteira');

    server.use(http.get('*/users/me', () => HttpResponse.json(marina)));
    await userEvent.setup().click(retry);

    await mainNav();
    expect(currentUrl(router)).toBe('/carteira');
  });
});

describe('rotas públicas', () => {
  it('com sessão, /entrar redireciona para /carteira', async () => {
    const { router } = renderApp('/entrar', { user: marina });

    await waitFor(() => expect(currentUrl(router)).toBe('/carteira'));
    await mainNav();
  });

  it('com sessão, /criar-conta também redireciona', async () => {
    const { router } = renderApp('/criar-conta', { user: marina });

    await waitFor(() => expect(currentUrl(router)).toBe('/carteira'));
  });

  it('com sessão, um next interno leva ao destino pedido', async () => {
    const { router } = renderApp('/entrar?next=%2Ftransferir', { user: marina });

    await waitFor(() => expect(currentUrl(router)).toBe('/transferir'));
  });

  // Quebra se: o login já autenticado seguir um next externo (RF3): redirecionamento aberto.
  it.each([['https%3A%2F%2Fevil.com'], ['%2F%2Fevil.com']])('com sessão, o next externo %s não é seguido', async (next) => {
    const { router } = renderApp(`/entrar?next=${next}`, { user: marina });

    await waitFor(() => expect(currentUrl(router)).toBe('/carteira'));
  });

  it.each([['/entrar'], ['/criar-conta']])('sem sessão, %s abre sem redirecionar', async (route) => {
    const { router } = renderApp(route);

    await waitFor(() => expect(screen.queryByText('Carregando…')).toBeNull());
    expect(currentUrl(router)).toBe(route);
  });
});

describe('outras rotas', () => {
  it.each([[null], [marina]])('rota desconhecida mostra a página não encontrada (sessão: %j)', async (user) => {
    const { router } = renderApp('/nao-existe', { user });

    expect(await screen.findByRole('heading', { name: 'Essa página não existe.' })).toBeInTheDocument();
    expect(currentUrl(router)).toBe('/nao-existe');
  });

  // Quebra se: a raiz exigir sessão ou redirecionar: a vitrine é pública e fica na raiz.
  it.each([[null], [marina]])('a raiz abre a vitrine sem redirecionar (sessão: %j)', async (user) => {
    const { router } = renderApp('/', { user });

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(currentUrl(router)).toBe('/');
  });
});

describe('AppShell', () => {
  // Quebra se: aparecer mais de uma nav (a barra de baixo no celular não pode ser uma segunda nav duplicada), faltar
  // um item, ou o item ativo não ser marcado para o leitor de tela.
  it('tem uma única nav com Carteira, Transferir e Extrato e marca o ativo com aria-current=page', async () => {
    const { router } = renderApp('/extrato', { user: marina });

    const nav = await mainNav();
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Carteira', 'Transferir', 'Extrato']);
    expect(within(nav).getByRole('link', { name: 'Extrato' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Carteira' })).not.toHaveAttribute('aria-current');

    await userEvent.setup().click(within(nav).getByRole('link', { name: 'Transferir' }));

    await waitFor(() => expect(currentUrl(router)).toBe('/transferir'));
    expect(within(nav).getByRole('link', { name: 'Transferir' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Extrato' })).not.toHaveAttribute('aria-current');
  });

  it('mostra o nome da pessoa e o botão Sair', async () => {
    renderApp('/carteira', { user: marina });

    await mainNav();
    expect(screen.getByText('Marina')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  // Quebra se: o Sair levar com um next (a próxima pessoa a entrar cairia na página da anterior) ou deixar a tela privada.
  it('Sair volta a /entrar, sem next, e a tela privada some', async () => {
    server.use(http.post('*/auth/logout', () => new HttpResponse(null, { status: 204 })));
    const { router } = renderApp('/carteira', { user: marina });
    await mainNav();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(currentUrl(router)).toBe('/entrar'));
    expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull();
  });

  // A mesma árvore de rotas, com a rota `path` demorando `ms` para abrir (um carregador lento), como num celular ou num servidor de CI
  // lento: a navegação para ela fica pendente, e a guarda da tela de onde se sai ainda está montada.
  function withSlowRoute(tree: RouteObject[], path: string, ms: number): RouteObject[] {
    return tree.map((route) => ({
      ...route,
      ...(route.path === path ? { loader: () => new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)) } : {}),
      ...(route.children ? { children: withSlowRoute(route.children, path, ms) } : {}),
    })) as RouteObject[];
  }

  // Quebra se: o Sair, com a navegação para /entrar ainda em andamento, deixar a guarda das telas privadas (que acaba de ver a sessão
  // ir a null) mandar a pessoa a /entrar?next=%2Fcarteira: a próxima pessoa a entrar cairia na página da anterior. Era uma corrida:
  // no computador do autor a navegação ganhava, no servidor de CI não, e o teste de cima falhava só lá.
  it('Sair vai a /entrar sem next também quando a navegação demora', async () => {
    server.use(http.post('*/auth/logout', () => new HttpResponse(null, { status: 204 })));
    const { router } = renderApp('/carteira', { user: marina, tree: withSlowRoute(routes, '/entrar', 150) });
    await mainNav();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(currentUrl(router)).toBe('/entrar'), { timeout: 3000 });
    // Depois que tudo assenta (a navegação lenta e qualquer redirecionamento da guarda), continua sem next.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(currentUrl(router)).toBe('/entrar');
    expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull();
  });

  // Quebra se: o marcador de saída não for apagado ao entrar de novo: a sessão que vence depois perderia o destino (`next`) e a pessoa
  // voltaria à carteira em vez da tela em que estava.
  it('depois de sair e entrar de novo, a sessão que vence volta a levar o destino', async () => {
    server.use(
      http.post('*/auth/logout', () => new HttpResponse(null, { status: 204 })),
      http.post('*/auth/login', () => HttpResponse.json(marina)),
    );
    const { router, queryClient } = renderApp('/carteira', { user: marina });
    await mainNav();
    const person = userEvent.setup();
    await person.click(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(currentUrl(router)).toBe('/entrar'));

    await person.type(await screen.findByLabelText('E-mail'), 'marina@arco.demo');
    await person.type(screen.getByLabelText('Senha'), 'demo1234');
    await person.click(screen.getByRole('button', { name: 'Entrar na carteira' }));
    await waitFor(() => expect(currentUrl(router)).toBe('/carteira'));

    // A sessão vence e a consulta dela mesma (que trata 401 como "deslogado", sem passar pelo tratamento global de 401) volta null.
    server.use(http.get('*/users/me', () => errorResponse(401, 'UNAUTHENTICATED')));
    await queryClient.invalidateQueries({ queryKey: ['session'] });

    await waitFor(() => expect(currentUrl(router)).toBe('/entrar?next=%2Fcarteira'));
  });

  // Quebra se: o Sair fingir que saiu quando o servidor não respondeu (o cookie HttpOnly continuaria vivo).
  it('se o logout falha, a pessoa continua dentro e vê o motivo', async () => {
    server.use(http.post('*/auth/logout', () => HttpResponse.error()));
    const { router } = renderApp('/carteira', { user: marina });
    await mainNav();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Sair' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não deu para sair. Sem conexão com o servidor.');
    expect(currentUrl(router)).toBe('/carteira');
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
  });

  // Quebra se: a sessão acabar (1 hora) com a pessoa numa tela que só consulta (o extrato, a busca de destinatário) e o app
  // ficar mostrando um aviso e nada mais, em vez de levá-la a entrar, como já faz no envio (RF3).
  it('o 401 de qualquer consulta (aqui, o extrato) leva ao login com o destino e derruba a sessão', async () => {
    server.use(http.get('*/transaction', () => errorResponse(401, 'UNAUTHENTICATED')));

    const { router, queryClient } = renderApp('/extrato', { user: marina });

    await waitFor(() => expect(currentUrl(router)).toBe('/entrar?next=%2Fextrato'));
    expect(queryClient.getQueryData(sessionKey)).toBeNull();
  });

  it('o 401 de uma chamada em andamento leva ao login com o destino', async () => {
    const { router, queryClient } = renderApp('/carteira', { user: marina });
    await mainNav();

    server.use(http.get('*/users/me', () => errorResponse(401, 'UNAUTHENTICATED')));
    await queryClient.invalidateQueries({ queryKey: ['session'] });

    await waitFor(() => expect(currentUrl(router)).toBe('/entrar?next=%2Fcarteira'));
  });
});

// O título da aba e do histórico diz onde a pessoa está (e é o que o leitor de tela lê ao trocar de tela num app de uma página só).
describe('título da página (WCAG 2.4.2)', () => {
  // Quebra se: todas as telas ficarem com o mesmo título: abas e histórico iguais, e quem usa leitor de tela sem aviso de que a
  // tela mudou.
  it.each([
    ['/entrar', 'Entrar na carteira | Arco', null],
    ['/criar-conta', 'Criar minha carteira | Arco', null],
    ['/carteira', 'Carteira | Arco', marina],
    ['/transferir', 'Transferir | Arco', marina],
    ['/extrato', 'Extrato | Arco', marina],
    ['/nao-existe', 'Página não encontrada | Arco', null],
    ['/', 'Arco', null],
  ])('%s tem o título "%s"', async (route, title, user) => {
    document.title = 'um título qualquer';
    renderApp(route, { user });

    await waitFor(() => expect(document.title).toBe(title));
  });

  // Quebra se: o título de uma tela ficar para a próxima (a vitrine, sem hook, herdaria "Carteira | Arco").
  it('trocar de tela troca o título, inclusive de volta para a vitrine', async () => {
    const { router } = renderApp('/carteira', { user: marina });
    await waitFor(() => expect(document.title).toBe('Carteira | Arco'));

    await userEvent.setup().click(await screen.findByRole('link', { name: 'Extrato' }));
    await waitFor(() => expect(document.title).toBe('Extrato | Arco'));

    await router.navigate('/');
    await waitFor(() => expect(document.title).toBe('Arco'));
  });
});

// Num app de uma página só o navegador não move o foco ao trocar de tela (WCAG 2.4.3): ele ficaria no link da nav, ou no corpo da página
// se o botão clicado saiu com a tela. O RouteFocus o leva ao título da tela nova (o isolado dele está em RouteFocus.test).
describe('foco ao trocar de tela', () => {
  // Quebra se: a nav continuar com o foco depois do clique: o leitor de tela não anuncia a tela nova e o Tab seguinte segue da nav.
  it('ir pela nav a outra tela leva o foco ao título dela', async () => {
    renderApp('/carteira', { user: marina });
    const nav = await mainNav();

    await userEvent.setup().click(within(nav).getByRole('link', { name: 'Extrato' }));

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Extrato' })).toHaveFocus());
  });

  // Quebra se: sair deixar o foco no corpo da página, onde o botão "Sair" estava antes de a tela sumir.
  it('sair leva o foco ao título do login', async () => {
    server.use(http.post('*/auth/logout', () => new HttpResponse(null, { status: 204 })));
    renderApp('/carteira', { user: marina });
    await mainNav();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Entrar na carteira' })).toHaveFocus());
  });

  // Quebra se: abrir o app tirar o foco do lugar em que o navegador o deixou.
  it('a primeira tela não rouba o foco', async () => {
    renderApp('/extrato', { user: marina });

    await screen.findByRole('heading', { level: 1, name: 'Extrato' });
    expect(document.body).toHaveFocus();
  });
});
