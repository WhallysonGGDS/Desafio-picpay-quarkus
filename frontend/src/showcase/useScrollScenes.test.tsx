import { act, render, screen } from '@testing-library/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { StrictMode, useLayoutEffect, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMPACT_WINDOW_QUERY, REDUCED_MOTION_QUERY, SCENE_PROGRESS_EVENT } from './motion';
import { Scene, useSceneProgress, type SceneId } from './Scene';
import { useScrollScenes } from './useScrollScenes';

// O Lenis mexe em roda, toque e requestAnimationFrame do navegador: aqui só interessa quando nasce, com quê e quando morre.
// Quem anda de verdade é conferido no Playwright, num navegador. O GSAP e o ScrollTrigger rodam de verdade, no jsdom.
const created = vi.hoisted(() => [] as FakeLenis[]);
interface FakeLenis {
  options: unknown;
  destroyed: boolean;
  on: ReturnType<typeof vi.fn>;
  raf: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

vi.mock('lenis', () => ({
  default: class implements FakeLenis {
    options: unknown;
    destroyed = false;
    on = vi.fn(() => () => undefined);
    raf = vi.fn();
    destroy = vi.fn(() => {
      this.destroyed = true;
    });
    constructor(options: unknown) {
      this.options = options;
      created.push(this);
    }
  },
}));

/**
 * Controla `prefers-reduced-motion` e a janela compacta e avisa quem escuta quando mudam, como o navegador faz. Cada consulta
 * responde só por si: qualquer outra não casa.
 */
function media(initial: { reduced?: boolean; compact?: boolean } = {}) {
  const state = { reduced: initial.reduced ?? false, compact: initial.compact ?? false };
  const listeners = { reduced: new Set<() => void>(), compact: new Set<() => void>() };
  const kindOf = (query: string) => (query === REDUCED_MOTION_QUERY ? 'reduced' : query === COMPACT_WINDOW_QUERY ? 'compact' : null);
  vi.stubGlobal('matchMedia', (query: string) => {
    const kind = kindOf(query);
    return {
      get matches() {
        return kind ? state[kind] : false;
      },
      media: query,
      addEventListener: (_type: string, listener: () => void) => kind && listeners[kind].add(listener),
      removeEventListener: (_type: string, listener: () => void) => kind && listeners[kind].delete(listener),
    };
  });
  const change = (kind: 'reduced' | 'compact', next: boolean) => {
    state[kind] = next;
    listeners[kind].forEach((listener) => listener());
  };
  return {
    set: (next: boolean) => change('reduced', next),
    setCompact: (next: boolean) => change('compact', next),
    listenerCount: () => listeners.reduced.size + listeners.compact.size,
  };
}

const IDS: SceneId[] = [1, 2, 3, 4, 5, 6];

function Probe() {
  return <output data-testid="probe">{useSceneProgress()}</output>;
}

function Harness() {
  const root = useRef<HTMLDivElement>(null);
  useScrollScenes(root);
  return (
    <div ref={root}>
      {IDS.map((id) => (
        <Scene key={id} id={id} pinned={id === 2 || id === 3}>
          <p>cena {id}</p>
          {id === 3 && <Probe />}
        </Scene>
      ))}
    </div>
  );
}

const progresses = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-scene]')).map((scene) => scene.getAttribute('data-progress'));

beforeEach(() => {
  created.length = 0;
  vi.stubGlobal('scrollTo', vi.fn());
});

afterEach(() => {
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (document as { fonts?: unknown }).fonts;
});

describe('useScrollScenes', () => {
  // Quebra se: o motor se desfizer num efeito comum (passivo) em vez de num efeito de layout. Ao trocar de tela o React desfaz os
  // efeitos de layout da tela que sai ANTES de rodar os da que entra, e os efeitos comuns só depois da pintura. A rota-layout
  // (RouteFocus) leva a página ao topo num efeito de layout: com o Lenis ainda vivo nesse intervalo, e a rolagem suave andando, ele
  // escrevia o alvo dele por cima do topo (preso ao fim da página nova) e o cadastro, aberto pelo CTA no fim da vitrine, abria rolado
  // até o fim (visto no navegador em 5 de 8 tentativas; o teste do Playwright confere o resultado, e este, a ordem que o causava).
  it('desfaz o Lenis antes dos efeitos de layout da tela que entra, onde a rota-layout leva a página ao topo', () => {
    media();
    const lenisWhenTheNewScreenLaidOut: boolean[] = [];
    function NextScreen() {
      useLayoutEffect(() => {
        lenisWhenTheNewScreenLaidOut.push(created[0]!.destroyed);
      }, []);
      return <p>tela nova</p>;
    }
    const App = ({ showcase }: { showcase: boolean }) => (showcase ? <Harness /> : <NextScreen />);
    const { rerender } = render(<App showcase />);
    expect(created).toHaveLength(1);

    rerender(<App showcase={false} />);

    expect(lenisWhenTheNewScreenLaidOut).toEqual([true]);
  });

  // RF5. Quebra se: com movimento reduzido a vitrine criar o Lenis ou os pins (a rolagem suave e as cenas presas são
  // exatamente o que essa pessoa pediu para não ter), ou deixar o conteúdo que depende de --p escondido.
  it('com movimento reduzido: todas as cenas em 1.000, sem Lenis, sem pins, sem ScrollTrigger', () => {
    media({ reduced: true });

    const { container } = render(<Harness />);

    expect(progresses(container)).toEqual(Array(6).fill('1.000'));
    expect((container.querySelector('[data-scene="1"]') as HTMLElement).style.getPropertyValue('--p')).toBe('1.000');
    expect(created).toHaveLength(0);
    expect(container.querySelectorAll('.pin-spacer')).toHaveLength(0);
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });

  // Quebra se: numa janela estreita e baixa (celular deitado) as cenas fixadas continuarem presas: o palco delas não cabe na altura
  // da janela e o texto de uma passa por cima do de outra. Ficam em fluxo, já no estado final; o resto segue o scroll.
  it('janela compacta: as cenas fixadas não prendem e ficam em 1.000; as outras seguem o scroll', () => {
    media({ compact: true });

    const { container } = render(<Harness />);

    expect(container.querySelectorAll('.pin-spacer')).toHaveLength(0);
    const [, two, three] = progresses(container); // as outras cenas ficam com o ScrollTrigger (no jsdom, sem layout, ele as dá por completas)
    expect([two, three]).toEqual(['1.000', '1.000']);
    expect(ScrollTrigger.getAll()).toHaveLength(4);
    expect(created).toHaveLength(1); // a rolagem suave continua: só as cenas fixadas mudam
    expect(screen.getByTestId('probe')).toHaveTextContent('1'); // o saldo da cena 3 já mostra o fim
  });

  // Quebra se: girar o celular com a página aberta não refizer a vitrine (ficaria com pins numa janela baixa, ou sem eles numa alta).
  it('a janela vira compacta ao vivo: desfaz os pins; voltar a recria', () => {
    const preference = media();
    const { container } = render(<Harness />);
    expect(container.querySelectorAll('.pin-spacer')).toHaveLength(2);

    act(() => preference.setCompact(true));

    expect(container.querySelectorAll('.pin-spacer')).toHaveLength(0);
    expect(ScrollTrigger.getAll()).toHaveLength(4);
    expect(progresses(container)[1]).toBe('1.000');
    expect(created[0]?.destroy).toHaveBeenCalledTimes(1);

    act(() => preference.setCompact(false));

    expect(container.querySelectorAll('.pin-spacer')).toHaveLength(2);
    expect(ScrollTrigger.getAll()).toHaveLength(6);
    expect(progresses(container)[1]).toBe('0.000');
  });

  // Quebra se: movimento reduzido deixar de vencer a janela compacta (nenhum Lenis, nenhum trigger, tudo no fim).
  it('movimento reduzido vale também em janela compacta: tudo em 1.000, sem Lenis nem triggers', () => {
    media({ reduced: true, compact: true });

    const { container } = render(<Harness />);

    expect(progresses(container)).toEqual(Array(6).fill('1.000'));
    expect(created).toHaveLength(0);
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });

  // Quebra se: o Lenis nascer com outra suavidade, não avisar o ScrollTrigger quando a página anda (os pins e o progresso
  // ficariam parados) ou fixar uma cena que não é fixada (ou deixar de fixar a que é).
  it('com movimento: cria o Lenis (lerp 0,1), liga ao ScrollTrigger e fixa só as cenas 2 e 3', () => {
    media();

    const { container } = render(<Harness />);

    expect(created).toHaveLength(1);
    expect(created[0]?.options).toEqual({ lerp: 0.1 });
    expect(created[0]?.on).toHaveBeenCalledWith('scroll', ScrollTrigger.update);
    expect(ScrollTrigger.getAll()).toHaveLength(6);
    const spacers = Array.from(container.querySelectorAll('.pin-spacer'));
    expect(spacers.map((spacer) => spacer.querySelector('[data-scene]')?.getAttribute('data-scene'))).toEqual(['2', '3']);
  });

  // Quebra se: o relógio do GSAP não alimentar o Lenis (a rolagem suave pararia no primeiro quadro) ou o fizer na unidade
  // errada: o ticker do GSAP conta em segundos e o Lenis em milissegundos.
  it('o ticker do GSAP alimenta o Lenis, em milissegundos', () => {
    media();
    const add = vi.spyOn(gsap.ticker, 'add');

    render(<Harness />);
    const tick = add.mock.calls[0]?.[0] as (time: number) => void;
    tick(2);

    expect(created[0]?.raf).toHaveBeenCalledWith(2000);
  });

  // Quebra se: o motor não escrever o progresso (atributo e variável CSS) ou não avisar a cena (o saldo da cena 3 é texto
  // e só anda se alguém o avisar), ou avisar a cada quadro mesmo sem mudança (um render do React por quadro, à toa).
  it('escreve o progresso na cena e avisa quem escuta, só quando ele muda', () => {
    media();
    const { container } = render(<Harness />);
    const scene = container.querySelector('[data-scene="3"]') as HTMLElement;
    const trigger = ScrollTrigger.getAll()[2] as ScrollTrigger;
    const update = (progress: number) => act(() => trigger.vars.onUpdate?.({ progress } as ScrollTrigger));
    let notices = 0;
    scene.addEventListener(SCENE_PROGRESS_EVENT, () => (notices += 1));

    update(0.4);

    expect(scene).toHaveAttribute('data-progress', '0.400');
    expect(scene.style.getPropertyValue('--p')).toBe('0.400');
    expect(screen.getByTestId('probe')).toHaveTextContent('0.4');
    expect(notices).toBe(1);

    update(0.4);
    update(0.4001); // mesmas três casas: nada a avisar
    expect(notices).toBe(1);

    update(0.5);
    expect(notices).toBe(2);
    expect(screen.getByTestId('probe')).toHaveTextContent('0.5');
  });

  // Quebra se: com movimento reduzido o texto que depende do scroll ficar no estado de antes (o saldo mostraria R$ 1.000,00
  // para quem não pode ver a animação que o levaria a R$ 750,00).
  it('com movimento reduzido, quem escuta já recebe o progresso final', () => {
    media({ reduced: true });

    render(<Harness />);

    expect(screen.getByTestId('probe')).toHaveTextContent('1');
  });

  // Quebra se: sair da vitrine deixar o Lenis escutando a roda, ScrollTriggers órfãos ou pins no DOM: a carteira herdaria a
  // rolagem suave e triggers apontando para elementos que já não existem.
  it('ao desmontar desfaz tudo: Lenis destruído, nenhum ScrollTrigger vivo, nenhum pin', () => {
    const preference = media();
    const add = vi.spyOn(gsap.ticker, 'add');
    const remove = vi.spyOn(gsap.ticker, 'remove');
    const lagSmoothing = vi.spyOn(gsap.ticker, 'lagSmoothing');
    const { unmount } = render(<Harness />);
    expect(preference.listenerCount()).toBe(2); // movimento reduzido e janela compacta
    expect(lagSmoothing).toHaveBeenCalledWith(0); // sem isso o GSAP "perdoa" quadros lentos e o scroll e o arco se descolam
    const tick = add.mock.calls[0]?.[0];
    // O próprio ticker.add chama ticker.remove(callback) por dentro (para não duplicar): só vale a remoção DEPOIS de sair.
    const removalsOfTick = () => remove.mock.calls.filter(([callback]) => callback === tick).length;
    const before = removalsOfTick();

    unmount();

    expect(removalsOfTick()).toBeGreaterThan(before); // o relógio do GSAP não pode continuar chamando um Lenis morto
    expect(lagSmoothing).toHaveBeenLastCalledWith(500, 33); // devolve o padrão do GSAP às outras telas
    expect(created[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(ScrollTrigger.getAll()).toHaveLength(0);
    expect(document.querySelectorAll('.pin-spacer')).toHaveLength(0);
    expect(preference.listenerCount()).toBe(0);
  });

  // Quebra se: o StrictMode do desenvolvimento (montar, desmontar, montar) deixar dois conjuntos de triggers e dois Lenis vivos.
  it('em StrictMode não duplica: seis triggers e um Lenis vivo', () => {
    media();

    render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    );

    expect(ScrollTrigger.getAll()).toHaveLength(6);
    expect(created.filter((lenis) => !lenis.destroyed)).toHaveLength(1);
  });

  // Quebra se: a vitrine só olhar a preferência na montagem: quem liga "reduzir movimento" no sistema com a página aberta
  // continuaria com pins e rolagem suave.
  it('a preferência muda ao vivo: reduzir desfaz o Lenis e os pins; voltar recria', () => {
    const preference = media();
    const { container } = render(<Harness />);
    expect(container.querySelectorAll('.pin-spacer')).toHaveLength(2);

    act(() => preference.set(true));

    expect(created[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(ScrollTrigger.getAll()).toHaveLength(0);
    expect(container.querySelectorAll('.pin-spacer')).toHaveLength(0);
    expect(progresses(container)).toEqual(Array(6).fill('1.000'));

    act(() => preference.set(false));

    expect(created).toHaveLength(2);
    expect(ScrollTrigger.getAll()).toHaveLength(6);
    expect(container.querySelectorAll('.pin-spacer')).toHaveLength(2);
  });

  // Quebra se: os triggers não forem recalculados quando as fontes chegam (o texto muda de altura e as cenas fixadas
  // começam e terminam no lugar errado), ou se refizerem depois de a vitrine ter saído.
  it('recalcula os triggers quando as fontes terminam de carregar, e só se a vitrine ainda está lá', async () => {
    media();
    let loaded!: () => void;
    (document as { fonts?: unknown }).fonts = {
      ready: new Promise<void>((resolve) => {
        loaded = resolve;
      }),
    };
    const refresh = vi.spyOn(ScrollTrigger, 'refresh');

    const first = render(<Harness />);
    refresh.mockClear();
    loaded();
    await Promise.resolve();
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);
    first.unmount();

    let loadedLate!: () => void;
    (document as { fonts?: unknown }).fonts = {
      ready: new Promise<void>((resolve) => {
        loadedLate = resolve;
      }),
    };
    const second = render(<Harness />);
    second.unmount();
    refresh.mockClear();
    loadedLate();
    await Promise.resolve();
    await Promise.resolve();
    expect(refresh).not.toHaveBeenCalled();
  });
});
