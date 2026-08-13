import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { waitForLoadingComplete } from './transition';

export const colExists = async (page: Page, colName: string, exists: boolean): Promise<void> => {
  const header = page.locator(`th[data-label="${colName}"]`);
  if (exists) {
    await expect(header).toHaveCount(1);
  } else {
    await expect(header).toHaveCount(0);
  }
};

export const expectColumnHeaderVisible = async (page: Page, columnName: string): Promise<void> => {
  await expect(
    page
      .locator('table thead')
      .locator('th')
      .filter({ hasText: new RegExp(`^${columnName}$`, 'i') })
  ).toBeVisible();
};

export const expectColumnHeaderHidden = async (page: Page, columnName: string): Promise<void> => {
  await expect(
    page
      .locator('table thead')
      .locator('th')
      .filter({ hasText: new RegExp(`^${columnName}$`, 'i') })
  ).toHaveCount(0);
};

export const getColWithRowText = (page: Page, rowSearchText: string, colName: string): Locator => {
  return page
    .locator('tbody')
    .getByRole('row')
    .filter({ hasText: rowSearchText })
    .locator(`td[data-label="${colName}"]`);
};

export const ensureObjectsInTable = async (page: Page, ...names: string[]): Promise<void> => {
  const rows = page.locator('tbody tr');
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThanOrEqual(names.length);

  for (const name of names) {
    await expect(page.locator('tbody').getByRole('row').filter({ hasText: name })).toBeVisible();
  }
};

export const expectTableContainsRow = async (page: Page, name: string): Promise<void> => {
  await expect(page.locator('tbody').getByRole('row').filter({ hasText: name })).toBeVisible();
};

export const expectOnlyRow = async (page: Page, name: string): Promise<void> => {
  await expectTableContainsRow(page, name);
  await expect(page.locator('tbody tr')).toHaveCount(1);
};

export const expectRowCount = async (page: Page, count: number): Promise<void> => {
  await expect(page.locator('tbody tr')).toHaveCount(count);
};

const healthIconClasses = ['icon-healthy', 'icon-unhealthy', 'icon-degraded', 'icon-na'] as const;

export const expectHealthIconInRow = async (page: Page, rowText: string): Promise<void> => {
  const cell = getColWithRowText(page, rowText, 'Health');
  const icon = cell.locator('span.pf-v6-c-icon');
  await expect(icon).toBeVisible();
  const className = await icon.getAttribute('class');
  expect(className).toBeTruthy();
  expect(healthIconClasses.some(cls => className!.includes(cls))).toBeTruthy();
};

export const expectOnlyHealthyApps = async (page: Page): Promise<void> => {
  const icons = page.locator('tbody td[data-label="Health"] span.pf-v6-c-icon');
  const count = await icons.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const className = await icons.nth(i).getAttribute('class');
    expect(className).toBeTruthy();
    expect(className!.includes('icon-healthy')).toBeTruthy();
  }
};

const rowDataTestId = (cluster: string, namespace: string, type: string | null, name: string): string => {
  const selector = type ? `${namespace}_${type}_${name}` : `${namespace}_${name}`;
  return `VirtualItem_Cluster${cluster}_Ns${selector}`;
};

export const checkHealthIndicatorInTable = async (
  page: Page,
  cluster: string,
  namespace: string,
  type: string | null,
  itemName: string,
  healthStatus: string
): Promise<void> => {
  const testId = rowDataTestId(cluster, namespace, type, itemName);
  const row = page.getByTestId(testId);
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const icon = row.locator(`span.icon-${healthStatus}`);
    if ((await icon.count()) > 0) {
      await expect(icon.first()).toBeVisible();
      return;
    }
    if (attempt < maxRetries) {
      await page.getByTestId('refresh-button').click();
      await waitForLoadingComplete(page);
    }
  }

  await expect(row.locator(`span.icon-${healthStatus}`)).toBeVisible({ timeout: 60_000 });
};

export const checkHealthStatusInTable = async (
  page: Page,
  cluster: string,
  namespace: string,
  type: string | null,
  itemName: string,
  healthStatus: string
): Promise<void> => {
  const testId = rowDataTestId(cluster, namespace, type, itemName);
  const row = page.getByTestId(testId);
  await expect(row).toBeVisible();
  const healthIcon = row.locator('td[data-label="Health"] .pf-v6-c-icon__content');
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await healthIcon.scrollIntoViewIfNeeded();
      await healthIcon.hover({ timeout: 10_000 });
      const tooltip = page.getByRole('tooltip');
      await expect(tooltip).toBeVisible({ timeout: 5_000 });
      await expect(tooltip.locator('strong')).toContainText(healthStatus, { timeout: 5_000 });
      return;
    } catch {
      if (attempt < maxRetries) {
        await page.getByTestId('refresh-button').click();
        await waitForLoadingComplete(page);
      }
    }
  }

  await healthIcon.scrollIntoViewIfNeeded();
  await healthIcon.hover();
  await expect(page.getByRole('tooltip').locator('strong')).toContainText(healthStatus, { timeout: 60_000 });
};

export const expectAppsWithNameCount = async (page: Page, request: Page['request'], name: string): Promise<void> => {
  const response = await request.get('/api/clusters/apps');
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { applications: Array<{ name: string }> };
  const count = body.applications.filter(item => item.name.includes(name)).length;
  await expect(page.locator('tbody')).not.toContainText('No apps found');
  await expect(page.locator('tbody tr')).toHaveCount(count);
};
