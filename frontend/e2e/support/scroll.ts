import { expect, type Page } from '@playwright/test';

/**
 * Rola a página até o ponto em que a cena `id` está no progresso `progress` (0 a 1) e espera o motor escrevê-lo. A conta é a
 * do ScrollTrigger: a abertura (cena 1) vai de "topo no topo" a "base no topo"; as fixadas, da chegada ao topo até o fim
 * do pin (a altura do espaçador menos a da cena); as demais, de "topo na base da janela" a "base no topo".
 */
export async function scrollToScene(page: Page, id: number, progress: number): Promise<void> {
  await page.evaluate(
    ([sceneId, p]) => {
      const scene = document.querySelector(`[data-scene="${sceneId}"]`) as HTMLElement;
      const spacer = scene.parentElement?.classList.contains('pin-spacer') ? scene.parentElement : null;
      const viewport = window.innerHeight;
      const box = (spacer ?? scene).getBoundingClientRect();
      const top = box.top + window.scrollY;
      let target: number;
      if (scene.hasAttribute('data-pinned') && spacer) target = top + p * (spacer.offsetHeight - scene.offsetHeight);
      else if (sceneId === '1') target = top + p * box.height;
      else target = top - viewport + p * (box.height + viewport);
      window.scrollTo(0, target);
    },
    [String(id), progress] as const,
  );
  const scene = page.locator(`[data-scene="${id}"]`);
  await expect.poll(async () => Number(await scene.getAttribute('data-progress')), { timeout: 5_000 }).toBeCloseTo(progress, 1);
}

/** O saldo que a cena 3 mostra agora, em centavos. */
export async function sceneBalanceCents(page: Page): Promise<number> {
  const text = (await page.getByTestId('wallet-balance').textContent()) ?? '';
  return Number(text.replace(/\D/g, ''));
}
