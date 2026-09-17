import type { Page } from '@playwright/test';
import { waitForLoadingComplete } from './transition';

/** Select one or more namespaces in the Kiali namespace dropdown (additive — does not clear others). */
export const selectNamespaces = async (page: Page, namespaces: string[]): Promise<void> => {
  await page.getByTestId('namespace-dropdown').click();
  for (const namespace of namespaces) {
    await page.getByTestId('namespace-dropdown-list').getByRole('checkbox', { name: namespace, exact: true }).check();
  }
  await page.getByTestId('namespace-dropdown').click();
  await waitForLoadingComplete(page);
};

/** Select a namespace in the Kiali namespace dropdown (PatternFly checkbox list). */
export const selectNamespace = async (page: Page, namespace: string): Promise<void> => {
  await selectNamespaces(page, [namespace]);
};

/** Select exactly the given namespaces (unchecks all others). */
export const selectOnlyNamespaces = async (page: Page, namespaces: string[]): Promise<void> => {
  const selected = new Set(namespaces);
  await page.getByTestId('namespace-dropdown').click();
  const checkboxes = page.getByTestId('namespace-dropdown-list').getByRole('checkbox');
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) {
    const checkbox = checkboxes.nth(i);
    const label = (await checkbox.getAttribute('aria-label')) ?? '';
    if (selected.has(label)) {
      await checkbox.check();
    } else {
      await checkbox.uncheck();
    }
  }
  await page.getByTestId('namespace-dropdown').click();
  await waitForLoadingComplete(page);
};
