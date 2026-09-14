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
