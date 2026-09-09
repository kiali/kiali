import { type Page } from '@playwright/test';
import { colExists } from './table';
import { waitForLoadingComplete } from './transition';

export async function openDetailsTab(page: Page, tab: string): Promise<void> {
  const tabsRoot = page.locator('#basic-tabs');
  const tabLocator = tabsRoot.getByRole('tab', { name: tab, exact: true });
  if ((await tabLocator.count()) > 0) {
    await tabLocator.click();
  } else {
    // Legacy PF markup (buttons inside .pf-v6-c-tabs__list) — matches Cypress openTab().
    await tabsRoot.locator('.pf-v6-c-tabs__list button').filter({ hasText: tab }).click();
  }
  await waitForLoadingComplete(page);
}

export async function expectClusterColumnHidden(page: Page): Promise<void> {
  await colExists(page, 'Cluster', false);
}
