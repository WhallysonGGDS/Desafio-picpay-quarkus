import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { useLayoutEffect, type RefObject } from 'react';
import {
  COMPACT_WINDOW_QUERY,
  formatProgress,
  isCompactWindow,
  prefersReducedMotion,
  REDUCED_MOTION_QUERY,
  SCENE_PROGRESS_EVENT,
} from './motion';

// Quantas alturas de janela de rolagem uma cena fixada consome enquanto o progresso dela vai de 0 a 1.
const PIN_DISTANCE = 1.5;
const HERO = '1';

/** Escreve o progresso da cena (três casas) no atributo e na variável CSS e avisa quem escuta (useSceneProgress), só se mudou. */
function write(scene: HTMLElement, progress: number): void {
  const value = formatProgress(progress);
  if (scene.dataset['progress'] === value) return;
  scene.dataset['progress'] = value;
  scene.style.setProperty('--p', value);
  scene.dispatchEvent(new Event(SCENE_PROGRESS_EVENT));
}

/**
 * Liga o motor às cenas de `root`: devolve o que o desfaz. Com movimento reduzido nada anda: sem Lenis, sem pins, e o
 * progresso fica em 1 (o CSS desenha tudo no estado final e o texto fica todo legível). Sem isso, um Lenis que suaviza a
 * roda e o ScrollTrigger, que escreve o progresso de cada cena e prende as fixadas. Numa janela compacta (celular deitado)
 * só as cenas fixadas ficam sem pin: em fluxo e no estado final, como no movimento reduzido; o resto da vitrine segue.
 */
function start(root: HTMLElement): () => void {
  const scenes = Array.from(root.querySelectorAll<HTMLElement>('[data-scene]'));

  if (prefersReducedMotion()) {
    scenes.forEach((scene) => write(scene, 1));
    return () => undefined;
  }

  const compact = isCompactWindow();
  gsap.registerPlugin(ScrollTrigger);
  const lenis = new Lenis({ lerp: 0.1 });
  const tick = (time: number) => lenis.raf(time * 1000);
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  // As cenas são criadas de cima para baixo: o ScrollTrigger calcula as posições na ordem de criação, e um pin
  // acrescenta altura (o spacer) a tudo o que vem depois.
  const context = gsap.context(() => {
    scenes.forEach((scene) => {
      const pinned = scene.hasAttribute('data-pinned');
      if (pinned && compact) {
        write(scene, 1);
        return;
      }
      const hero = scene.dataset['scene'] === HERO;
      ScrollTrigger.create({
        trigger: scene,
        // A abertura começa em 0 no topo da página; as fixadas, ao chegar ao topo; as demais, ao entrar pela base.
        start: pinned || hero ? 'top top' : 'top bottom',
        end: pinned ? () => `+=${Math.round(window.innerHeight * PIN_DISTANCE)}` : 'bottom top',
        pin: pinned,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => write(scene, self.progress),
        onRefresh: (self) => write(scene, self.progress),
      });
    });
  }, root);

  // As fontes mudam a altura do texto depois que as posições foram calculadas: recalcula quando terminam de carregar.
  let active = true;
  void document.fonts?.ready.then(() => {
    if (active) ScrollTrigger.refresh();
  });

  return () => {
    active = false;
    context.revert();
    gsap.ticker.remove(tick);
    gsap.ticker.lagSmoothing(500, 33);
    lenis.destroy();
  };
}

/**
 * O motor da vitrine: rolagem suave (Lenis), progresso e pins por cena (ScrollTrigger), tudo desfeito ao sair. Reage ao vivo à
 * preferência de movimento do sistema (ligar "reduzir movimento" com a página aberta tira o Lenis e os pins na hora) e ao
 * tamanho da janela (girar o celular liga ou desliga os pins).
 *
 * É um efeito de LAYOUT, e não um efeito comum, por causa de quem o desfaz: ao trocar de tela, o React desfaz os efeitos de layout
 * da tela que sai ANTES de rodar os da que entra, e os efeitos comuns só depois da pintura. A rota-layout (RouteFocus) leva a
 * página ao topo num efeito de layout: com o motor desfeito num efeito comum, o Lenis ainda estava vivo nesse intervalo e, se a
 * rolagem suave estivesse andando (quem clica no CTA antes de ela assentar), escrevia o alvo dele por cima do topo (preso ao fim da
 * página nova), e o cadastro abria rolado até o fim.
 */
export function useScrollScenes(root: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;

    let stop = start(element);
    const queries = [REDUCED_MOTION_QUERY, COMPACT_WINDOW_QUERY].map((query) => window.matchMedia(query));
    const onChange = () => {
      stop();
      stop = start(element);
    };
    queries.forEach((query) => query.addEventListener('change', onChange));

    return () => {
      queries.forEach((query) => query.removeEventListener('change', onChange));
      stop();
    };
  }, [root]);
}
