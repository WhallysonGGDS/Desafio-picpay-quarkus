import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { lazy, StrictMode, Suspense, type ComponentType, type ReactNode } from 'react';
import { createMemoryRouter, Link, RouterProvider, type RouteObject } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteFocus } from './RouteFocus';

// Telas mínimas: o que se confere aqui é onde o foco e a rolagem param depois de uma troca de tela, não o que a tela mostra. Cada uma é
// um componente próprio, como as telas de verdade: o React só reaproveita o DOM entre dois componentes do mesmo tipo.
function ScreenA() {
  return (
    <main>
      <h1>Tela A</h1>
      <button type="button">Um botão da tela A</button>
      <Link to="/b">Ir para B</Link>
    </main>
  );
}
function ScreenB() {
  return (
    <main>
      <h1>Tela B</h1>
    </main>
  );
}
function ScreenWithoutTitle() {
  return (
    <main>
      <p>Uma tela sem título</p>
    </main>
  );
}
function ScreenWithField() {
  return (
    <main>
      <h1>Tela com campo</h1>
      <input aria-label="Nome" autoFocus />
    </main>
  );
}
function ScreenWithoutMain() {
  return <div>Uma tela sem área principal</div>;
}

function SlowScreen() {
  return (
    <main>
      <h1>Tela que demorou</h1>
    </main>
  );
}
function SlowFormScreen() {
  return (
    <main>
      <h1>Formulário que demorou</h1>
      <input aria-label="Campo" autoFocus />
    </main>
  );
}
// A tela de espera é uma `main` ocupada, como o Splash do app, e a tela de verdade só chega quando o teste manda.
function Waiting() {
  return (
    <main aria-busy="true">
      <span className="sr-only">Carregando…</span>
    </main>
  );
}
function slow(Screen: ComponentType) {
  let arrive: () => void = () => undefined;
  const Lazy = lazy(
    () =>
      new Promise<{ default: ComponentType }>((resolve) => {
        arrive = () => resolve({ default: Screen });
      }),
  );
  return {
    element: (
      <Suspense fallback={<Waiting />}>
        <Lazy />
      </Suspense>
    ),
    arrive: () => arrive(),
  };
}
const slowScreen = slow(SlowScreen);
const slowFormScreen = slow(SlowFormScreen);

const screens: RouteObject[] = [
  { path: '/a', element: <ScreenA /> },
  { path: '/b', element: <ScreenB /> },
  { path: '/sem-titulo', element: <ScreenWithoutTitle /> },
  { path: '/com-campo', element: <ScreenWithField /> },
  { path: '/sem-main', element: <ScreenWithoutMain /> },
  { path: '/demora', element: slowScreen.element },
  { path: '/demora-com-campo', element: slowFormScreen.element },
];

function renderAt(initial: string, wrap: (children: ReactNode) => ReactNode = (children) => children) {
  const router = createMemoryRouter([{ element: <RouteFocus />, children: screens }], { initialEntries: [initial] });
  render(<>{wrap(<RouterProvider router={router} />)}</>);
  return router;
}

const go = (router: ReturnType<typeof renderAt>, to: string | number) =>
  act(() => (typeof to === 'number' ? router.navigate(to) : router.navigate(to)));

describe('RouteFocus', () => {
  const scrollTo = vi.fn();
  beforeEach(() => {
    // O jsdom não rola: window.scrollTo é só um aviso de "não implementado". Aqui ele é o que se observa.
    vi.spyOn(window, 'scrollTo').mockImplementation(scrollTo);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    scrollTo.mockReset();
  });

  // Quebra se: abrir o app tirar o foco do lugar em que o navegador o deixou (nada, o corpo da página) e rolar a página, ou a
  // troca de rota inicial (a guarda que redireciona) ser tratada como "primeira tela".
  it('na primeira tela não mexe no foco nem na rolagem', () => {
    renderAt('/a');

    expect(document.body).toHaveFocus();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  // Quebra se: o aviso for feito com um marcador de "primeira vez" que o StrictMode (que roda os efeitos duas vezes em
  // desenvolvimento) engana: o foco iria ao título já na abertura, só no desenvolvimento.
  it('nem sob o StrictMode, que roda os efeitos duas vezes ao montar', () => {
    renderAt('/a', (children) => <StrictMode>{children}</StrictMode>);

    expect(document.body).toHaveFocus();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  // Quebra se: ao trocar de tela o foco ficar no link clicado: quem usa teclado ou leitor de tela não ouve a tela nova, e o
  // próximo Tab segue da nav em vez de entrar na tela.
  it('depois de trocar de tela, o foco vai ao título da nova', async () => {
    renderAt('/a');

    await userEvent.setup().click(screen.getByRole('link', { name: 'Ir para B' }));

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Tela B' })).toHaveFocus());
  });

  it('sem título, o foco vai à área principal', async () => {
    const router = renderAt('/a');

    await go(router, '/sem-titulo');

    expect(screen.getByRole('main')).toHaveFocus();
  });

  // Quebra se: a troca de rota tirar o foco de um campo que a própria tela focou ao abrir (um formulário que começa pelo campo).
  it('se a tela nova já pôs o foco em algum lugar dentro dela, o mantém', async () => {
    const router = renderAt('/a');

    await go(router, '/com-campo');

    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveFocus();
  });

  // Quebra se: qualquer mudança de URL for tratada como tela nova: um filtro na busca ou uma âncora tiraria o foco de onde a
  // pessoa estava.
  it('mudar só a busca ou a âncora da URL não move o foco', async () => {
    const router = renderAt('/a');
    screen.getByRole('button', { name: 'Um botão da tela A' }).focus();

    await go(router, '/a?filtro=1');
    await go(router, '/a?filtro=1#fim');

    expect(screen.getByRole('button', { name: 'Um botão da tela A' })).toHaveFocus();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  // Quebra se: a tela nova abrir na altura em que a anterior foi deixada (a vitrine rolada até o fim leva a um cadastro que abre
  // lá embaixo, com o título fora da janela).
  it('uma tela nova abre no topo da página', async () => {
    const router = renderAt('/a');

    await go(router, '/b');

    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0, left: 0, behavior: 'instant' });
  });

  // Quebra se: o "voltar" do navegador também jogar a página ao topo (a pessoa perde o lugar que o navegador guardou) ou o foco
  // rolar a página até o título.
  it('ao voltar pelo histórico o foco vai ao título, mas a rolagem é do navegador', async () => {
    const router = renderAt('/a');
    await go(router, '/b');
    scrollTo.mockClear();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');

    await go(router, -1);

    expect(screen.getByRole('heading', { level: 1, name: 'Tela A' })).toHaveFocus();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  // Quebra se: o foco for dado à tela de espera (a `main` do Suspense) e a rota for dada por tratada: quando a tela de verdade chega a
  // espera some e o foco cai no corpo da página, sem que o leitor de tela ouça a tela nova (WCAG 2.4.3). Era o que acontecia ao
  // clicar na marca, em /entrar, com o pacote da vitrine ainda por baixar.
  it('uma tela que demora a chegar recebe o foco quando chega, e não a espera', async () => {
    const router = renderAt('/a');

    await go(router, '/demora');
    expect(screen.queryByRole('heading', { name: 'Tela que demorou' })).toBeNull();
    // Enquanto espera, nem a espera nem uma mudança qualquer da página (outra coisa que se atualiza) leva o foco à `main` ocupada.
    await act(async () => {
      document.body.append(document.createElement('aside'));
    });
    expect(document.body).toHaveFocus();
    await act(async () => slowScreen.arrive());

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Tela que demorou' })).toHaveFocus());
  });

  // Quebra se: a espera da tela anterior continuar de olho e levar o foco para a tela que ela já não é: a pessoa saiu dali para
  // outra, e a que demorou chegando não pode puxar nada.
  it('quem sai de uma tela que ainda carrega não tem o foco puxado quando ela chega', async () => {
    const router = renderAt('/a');
    await go(router, '/demora');
    await go(router, '/b');
    expect(screen.getByRole('heading', { level: 1, name: 'Tela B' })).toHaveFocus();
    (document.activeElement as HTMLElement).blur();

    await act(async () => slowScreen.arrive());

    expect(document.body).toHaveFocus();
  });

  // Quebra se: a tela que chegou depois já pôs o foco num campo dela (um formulário que começa pelo campo) e o foco for trocado pelo
  // título: quem já começou a digitar perderia o lugar.
  it('a tela que demorou e já pôs o foco num campo dela o mantém', async () => {
    const router = renderAt('/a');
    await go(router, '/demora-com-campo');

    await act(async () => slowFormScreen.arrive());

    expect(await screen.findByRole('textbox', { name: 'Campo' })).toHaveFocus();
  });

  it('uma tela sem área principal não quebra nem move o foco', async () => {
    const router = renderAt('/a');

    await go(router, '/sem-main');

    expect(screen.getByText('Uma tela sem área principal')).toBeInTheDocument();
    expect(document.body).toHaveFocus();
  });
});
