import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * As violações de acessibilidade (WCAG 2.0 A e AA, 2.1 AA) da página como ela está agora: uma linha por regra, com o
 * que ela diz e os primeiros elementos atingidos. Texto, não objeto: é o que aparece na falha do teste.
 */
export async function a11yViolations(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  return violations.map((violation) => {
    const targets = violation.nodes.slice(0, 4).map((node) => node.target.join(' '));
    return `${violation.id} (${violation.impact ?? 'sem grau'}): ${violation.help} → ${targets.join(' | ')}`;
  });
}

export async function expectNoA11yViolations(page: Page): Promise<void> {
  expect(await a11yViolations(page), 'violações de acessibilidade (axe)').toEqual([]);
}
