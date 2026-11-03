import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { useEffect, type RefObject } from 'react';
import { formatProgress, prefersReducedMotion } from './motion';

// Quantas alturas de janela de rolagem uma cena fixada consome enquanto o progresso dela vai de 0 a 1.
const PIN_DISTANCE = 1.5;
const HERO = '1';

/** Escreve o progresso da cena (três casas) no atributo e na variável CSS, só se mudou. */
function write(scene: HTMLElement, progress: number): void {
  const value = formatProgress(progress);
  if (scene.dataset['progress'] === value) return;
  scene.dataset['progress'] = value;
  scene.style.setProperty('--p', value);
}

/**
 * Liga o motor às cenas de `root`: devolve o que o desfaz. Com movimento reduzido nada anda: sem Lenis, sem pins, e o
 * progresso fica em 1 (o CSS desenha tudo no estado final e o texto fica todo legível). Sem isso, um Lenis que suaviza a
 * roda e o ScrollTrigger, que escreve o progresso de cada cena e prende as fixadas.
 */
function start(root: HTMLElement): () => void {
  const scenes = Array.from(root.querySelectorAll<HTMLElement>('[data-scene]'));

  if (prefersReducedMotion()) {
    scenes.forEach((scene) => write(scene, 1));
    return () => undefined;
  }

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
 * O motor da vitrine: rolagem suave (Lenis), progresso e pins por cena (ScrollTrigger), tudo desfeito ao sair. Reage à
 * preferência de movimento do sistema ao vivo: ligar "reduzir movimento" com a página aberta tira o Lenis e os pins na hora.
 */
export function useScrollScenes(root: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = root.current;
    if (!element) return;

    let stop = start(element);
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => {
      stop();
      stop = start(element);
    };
    preference.addEventListener('change', onChange);

    return () => {
      preference.removeEventListener('change', onChange);
      stop();
    };
  }, [root]);
}
