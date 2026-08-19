import type { Page } from '@playwright/test';
import { waitForLoadingComplete } from './transition';

/** Select a namespace in the Kiali namespace dropdown (PatternFly checkbox list). */
export const selectNamespace = async (page: Page, namespace: string): Promise<void> => {
  await page.getByTestId('namespace-dropdown').click();
  await page.getByTestId('namespace-dropdown-list').getByRole('checkbox', { name: namespace, exact: true }).check();
  await page.getByTestId('namespace-dropdown').click();
  await waitForLoadingComplete(page);
};
