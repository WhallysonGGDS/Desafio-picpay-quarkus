import { useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router-dom';

const BUSY_MAIN = 'main[aria-busy="true"]';

function focusScreen() {
  const main = document.querySelector<HTMLElement>('main');
  if (!main || main.contains(document.activeElement)) return;
  const target = main.querySelector<HTMLElement>('h1') ?? main;
  // Título e `main` não recebem foco por conta própria: só por código, e sem entrar na ordem do Tab (o próximo Tab segue dali).
  if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
  // O foco não rola: no topo a rolagem já foi feita, e no "voltar" ela é do navegador.
  target.focus({ preventScroll: true });
}

/**
 * Num app de uma página só, trocar de tela não é uma navegação para o navegador: o foco fica onde estava (no link da nav, ou
 * no corpo da página se o controle clicado saiu junto com a tela) e a rolagem fica na altura da tela anterior. Quem usa teclado
 * ou leitor de tela não percebe que a tela mudou (WCAG 2.4.3), e o cadastro aberto pelo fim da vitrine apareceria rolado até o
 * fim. A cada troca de caminho esta rota-layout faz o que o navegador faria numa página nova:
 *
 * - o foco vai ao título da tela nova (a `main` se não houver), a menos que a própria tela já tenha posto o foco em algum lugar
 *   dentro dela, como o envio, que foca o próprio título a cada passo;
 * - a página volta ao topo, menos no "voltar" e "avançar" do navegador, que guarda a rolagem de cada entrada do histórico.
 *
 * A primeira tela fica com o navegador (nada é roubado de quem acabou de abrir o app). Só muda de tela quem muda de caminho:
 * uma busca ou uma âncora nova na mesma URL não mexe em nada.
 *
 * Uma tela que ainda está sendo baixada (a vitrine é um pacote à parte) aparece como uma `main` ocupada (`aria-busy`): o foco
 * não vai a ela, que some quando a tela de verdade chega e o deixaria no corpo da página. Espera-se a tela de verdade.
 */
export function RouteFocus() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  // O caminho que já foi tratado. Comparar com ele, e não marcar "a primeira vez", é o que mantém a abertura do app intacta sob o
  // StrictMode, que roda os efeitos duas vezes ao montar.
  const handled = useRef(pathname);

  // Antes da pintura: a tela nova nunca aparece, nem por um quadro, na rolagem da anterior.
  useLayoutEffect(() => {
    if (handled.current === pathname) return;
    handled.current = pathname;

    if (navigationType !== 'POP') window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    if (!document.querySelector(BUSY_MAIN)) {
      focusScreen();
      return;
    }
    // A tela ainda carrega: o foco espera por ela. Sair para outra tela (a troca de caminho refaz o efeito) desliga a espera.
    const waiting = new MutationObserver(() => {
      if (document.querySelector(BUSY_MAIN)) return;
      waiting.disconnect();
      focusScreen();
    });
    waiting.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-busy'] });
    return () => waiting.disconnect();
  }, [pathname, navigationType]);

  return <Outlet />;
}
