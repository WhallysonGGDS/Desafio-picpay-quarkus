import { test, type Page } from '@playwright/test';

/**
 * Grava e2e/__screenshots__/<projeto>/<nome>.png, depois de as fontes carregarem e de as animações que terminam acabarem. As
 * capturas são para a revisão visual (o autor as recebe); ficam fora do git.
 *
 * Uma tela entra com um fade, e uma captura feita no meio dele sai apagada (o título "Confirmar." parecia cinza) e engana quem
 * revisa o design. As animações que se repetem (o pulso do destino) não são esperadas. A abertura da vitrine, "desenhando", é uma
 * captura de propósito no meio da animação: ela pede `settled: false`.
 */
export async function shot(page: Page, name: string, { settled = true }: { settled?: boolean } = {}): Promise<void> {
  // `goto` resolve no evento load, antes de o React montar a tela: sem esta espera a captura sai em branco.
  await page.waitForFunction(() => (document.getElementById('root')?.childElementCount ?? 0) > 0);
  await page.evaluate(() => document.fonts.ready);
  if (settled) {
    await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running' || animation.effect?.getTiming().iterations === Infinity));
  }
  await page.screenshot({ path: `e2e/__screenshots__/${test.info().project.name}/${name}.png` });
}
