import { act, render, screen } from '@testing-library/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { StrictMode, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCENE_PROGRESS_EVENT } from './motion';
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

/** Controla `prefers-reduced-motion` e avisa quem escuta quando ele muda, como o navegador faz. */
function motionPreference(initiallyReduced: boolean) {
  let reduced = initiallyReduced;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('reduce') ? reduced : !reduced;
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }));
  return {
    set(next: boolean) {
      reduced = next;
      listeners.forEach((listener) => listener());
    },
    listenerCount: () => listeners.size,
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
  // RF5. Quebra se: com movimento reduzido a vitrine criar o Lenis ou os pins (a rolagem suave e as cenas presas são
  // exatamente o que essa pessoa pediu para não ter), ou deixar o conteúdo que depende de --p escondido.
  it('com movimento reduzido: todas as cenas em 1.000, sem Lenis, sem pins, sem ScrollTrigger', () => {
    motionPreference(true);

    const { container } = render(<Harness />);

    expect(progresses(container)).toEqual(Array(6).fill('1.000'));
    expect((container.querySelector('[data-scene="1"]') as HTMLElement).style.getPropertyValue('--p')).toBe('1.000');
    expect(created).toHaveLength(0);
    expect(container.querySelectorAll('.pin-spacer')).toHaveLength(0);
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });

  // Quebra se: o Lenis nascer com outra suavidade, não avisar o ScrollTrigger quando a página anda (os pins e o progresso
  // ficariam parados) ou fixar uma cena que não é fixada (ou deixar de fixar a que é).
  it('com movimento: cria o Lenis (lerp 0,1), liga ao ScrollTrigger e fixa só as cenas 2 e 3', () => {
    motionPreference(false);

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
    motionPreference(false);
    const add = vi.spyOn(gsap.ticker, 'add');

    render(<Harness />);
    const tick = add.mock.calls[0]?.[0] as (time: number) => void;
    tick(2);

    expect(created[0]?.raf).toHaveBeenCalledWith(2000);
  });

  // Quebra se: o motor não escrever o progresso (atributo e variável CSS) ou não avisar a cena (o saldo da cena 3 é texto
  // e só anda se alguém o avisar), ou avisar a cada quadro mesmo sem mudança (um render do React por quadro, à toa).
  it('escreve o progresso na cena e avisa quem escuta, só quando ele muda', () => {
    motionPreference(false);
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
    motionPreference(true);

    render(<Harness />);

    expect(screen.getByTestId('probe')).toHaveTextContent('1');
  });

  // Quebra se: sair da vitrine deixar o Lenis escutando a roda, ScrollTriggers órfãos ou pins no DOM: a carteira herdaria a
  // rolagem suave e triggers apontando para elementos que já não existem.
  it('ao desmontar desfaz tudo: Lenis destruído, nenhum ScrollTrigger vivo, nenhum pin', () => {
    const preference = motionPreference(false);
    const add = vi.spyOn(gsap.ticker, 'add');
    const remove = vi.spyOn(gsap.ticker, 'remove');
    const lagSmoothing = vi.spyOn(gsap.ticker, 'lagSmoothing');
    const { unmount } = render(<Harness />);
    expect(preference.listenerCount()).toBe(1);
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
    motionPreference(false);

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
    const preference = motionPreference(false);
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
    motionPreference(false);
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
