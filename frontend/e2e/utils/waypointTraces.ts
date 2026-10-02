import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { openDetailsTab } from './detailsPage';
import { waitForLoadingComplete } from './transition';

export async function openTracesTab(page: Page): Promise<void> {
  await openDetailsTab(page, 'Traces');
  await waitForLoadingComplete(page);
}

export async function expectTraceScatterplot(page: Page): Promise<void> {
  const scatter = page.getByTestId('tracing-scatterplot');
  await expect(scatter).toBeVisible({ timeout: 60_000 });
  await expect(scatter).toContainText('Traces');
  await expect(page.getByTestId('trace-details-tabs')).toHaveCount(0);
}

/** Select a trace via URL `traceId` (stable without scatter fiber walks). */
export async function selectTraceById(page: Page, traceId: string): Promise<void> {
  const url = new URL(page.url());
  url.searchParams.set('traceId', traceId);
  url.searchParams.set('tab', 'traces');
  await page.goto(url.pathname + url.search + url.hash);
  await waitForLoadingComplete(page);
  await expect(page.getByTestId('trace-details-tabs')).toBeVisible({ timeout: 30_000 });
}

export async function expectTraceDetails(page: Page): Promise<void> {
  await expect(page.getByTestId('trace-details-tabs')).toBeVisible();
  await page.getByTestId('trace-details-kebab').click();
  await expect(page.getByTestId('trace-details-dropdown')).toContainText('View on Graph');
  await page.keyboard.press('Escape');
}
