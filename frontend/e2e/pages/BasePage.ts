import { expect, type Locator, type Page } from '@playwright/test';
import { waitForLoadingComplete } from '../utils/transition';

/**
 * Base page object — Console-inspired helpers (robustClick, waitForLoad, getBySel).
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

  /**
   * Click with a short retry when the element is briefly detached / covered
   * (common with PatternFly overlays and React re-renders).
   */
  async robustClick(locator: Locator, options?: { timeout?: number }): Promise<void> {
    const timeout = options?.timeout ?? 40_000;
    const deadline = Date.now() + timeout;
    let lastError: unknown;

    while (Date.now() < deadline) {
      try {
        await locator.click({ timeout: Math.min(5_000, deadline - Date.now()) });
        return;
      } catch (err) {
        lastError = err;
        await this.page.waitForTimeout(250);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`robustClick failed: ${String(lastError)}`);
  }

  async retryOnError<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (i < attempts - 1) {
          await this.page.waitForTimeout(500);
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`retryOnError failed: ${String(lastError)}`);
  }

  async expectVisible(locator: Locator): Promise<void> {
    await expect(locator).toBeVisible();
  }
}
