import { expect, type Locator, type Page } from '@playwright/test';
import { waitForLoadingComplete } from '../utils/transition';

/**
 * Base page object — Console-inspired helpers (waitForLoad, getBySel).
 * @see https://github.com/openshift/console/pull/16431
 */
export class BasePage {
  constructor(protected readonly page: Page) {}

  getBySel(name: string): Locator {
    return this.page.getByTestId(name);
  }

  async waitForLoad(): Promise<void> {
    await waitForLoadingComplete(this.page);
  }

  async expectVisible(locator: Locator): Promise<void> {
    await expect(locator).toBeVisible();
  }
}
