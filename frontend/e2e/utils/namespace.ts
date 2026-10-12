import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { waitForLoadingComplete } from './transition';

/** Select one or more namespaces in the Kiali namespace dropdown (additive — does not clear others). */
export const selectNamespaces = async (page: Page, namespaces: string[]): Promise<void> => {
  const dropdown = page.getByTestId('namespace-dropdown');
  await dropdown.click();
  const list = page.getByTestId('namespace-dropdown-list');
  await expect(list).toBeVisible();
  for (const namespace of namespaces) {
    // aria-label on the checkbox (NamespaceDropdown); wait until the ns appears after page load.
    const checkbox = list.getByRole('checkbox', { name: namespace, exact: true });
    await expect(checkbox).toBeVisible({ timeout: 60_000 });
    await checkbox.check();
  }
  await dropdown.click();
  await waitForLoadingComplete(page);
};

/** Select a namespace in the Kiali namespace dropdown (PatternFly checkbox list). */
export const selectNamespace = async (page: Page, namespace: string): Promise<void> => {
  await selectNamespaces(page, [namespace]);
};

/** Select exactly the given namespaces (unchecks all others). */
export const selectOnlyNamespaces = async (page: Page, namespaces: string[]): Promise<void> => {
  const selected = new Set(namespaces);
  const dropdown = page.getByTestId('namespace-dropdown');
  await dropdown.click();
  const list = page.getByTestId('namespace-dropdown-list');
  await expect(list).toBeVisible();
  const checkboxes = list.locator('input[type="checkbox"][value]');
  await expect(checkboxes.first()).toBeVisible({ timeout: 60_000 });
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) {
    const checkbox = checkboxes.nth(i);
    const value = (await checkbox.getAttribute('value')) ?? '';
    if (selected.has(value)) {
      await checkbox.check();
    } else {
      await checkbox.uncheck();
    }
  }
  await dropdown.click();
  await waitForLoadingComplete(page);
};
