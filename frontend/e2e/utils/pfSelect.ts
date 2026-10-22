import type { Page } from '@playwright/test';

/**
 * Choose an option from a PatternFly Select toggle (or a native <select>, when present)
 * using the deterministic form ids used by the wizard components.
 *
 * @param page Playwright page
 * @param option Option label to select
 * @param id Deterministic id of the select control (e.g. "addPortProtocol_0")
 */
export async function chooseFromSelect(page: Page, option: string, id: string): Promise<void> {
  const select = page.locator(`select[id="${id}"]`);
  if ((await select.count()) > 0) {
    await select.selectOption(option);
    return;
  }
  await page.locator(`button[id="${id}-toggle"]`).click();
  // PF6 SelectOption renders with role="option"; no class-based fallback needed.
  await page
    .getByRole('option', { name: new RegExp(option, 'i') })
    .first()
    .click();
}
