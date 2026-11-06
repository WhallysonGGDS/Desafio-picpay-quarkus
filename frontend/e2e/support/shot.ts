import { test, type Page } from '@playwright/test';

/**
 * Grava e2e/__screenshots__/<projeto>/<nome>.png, depois de as fontes carregarem. As capturas são para a revisão
 * visual (o autor as recebe); ficam fora do git.
 */
export async function shot(page: Page, name: string): Promise<void> {
  // `goto` resolve no evento load, antes de o React montar a tela: sem esta espera a captura sai em branco.
  await page.waitForFunction(() => (document.getElementById('root')?.childElementCount ?? 0) > 0);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `e2e/__screenshots__/${test.info().project.name}/${name}.png` });
}
