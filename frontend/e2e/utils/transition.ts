import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Wait until Kiali finished its loading screens / login form / spinner.
 */
export const waitForLoadingComplete = async (page: Page): Promise<void> => {
  await expect(page.getByTestId('loading-screen')).toHaveCount(0);
  await expect(page.getByTestId('login-form')).toHaveCount(0);
  await expect(page.locator('#loading_kiali_spinner')).toHaveCount(0);
};

/** Click the page refresh control when present, then wait for Kiali to finish loading. */
export async function clickRefreshAndWait(page: Page): Promise<void> {
  const refresh = page.getByTestId('refresh-button');
  if (await refresh.isVisible()) {
    await refresh.click();
    await waitForLoadingComplete(page);
  }
}
