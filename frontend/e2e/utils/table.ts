import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const colExists = async (page: Page, colName: string, exists: boolean): Promise<void> => {
  const header = page.locator(`th[data-label="${colName}"]`);
  if (exists) {
    await expect(header).toHaveCount(1);
  } else {
    await expect(header).toHaveCount(0);
  }
};
