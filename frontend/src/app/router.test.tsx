import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { errorResponse } from '../test/api';
import { marina } from '../test/fixtures';
import { currentUrl, renderApp, renderRoutes } from '../test/render';
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

  it('o 401 de uma chamada em andamento leva ao login com o destino', async () => {
    const { router, queryClient } = renderApp('/carteira', { user: marina });
    await mainNav();

    server.use(http.get('*/users/me', () => errorResponse(401, 'UNAUTHENTICATED')));
    await queryClient.invalidateQueries({ queryKey: ['session'] });

    await waitFor(() => expect(currentUrl(router)).toBe('/entrar?next=%2Fcarteira'));
  });
});
