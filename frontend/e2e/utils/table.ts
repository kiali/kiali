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

const healthIconClasses = ['icon-degraded', 'icon-failure', 'icon-healthy', 'icon-na', 'icon-unhealthy'] as const;

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

  await expect(async () => {
    const icon = row.locator(`[class*="icon-${healthStatus}"]`);
    if ((await icon.count()) === 0) {
      await page.getByTestId('refresh-button').click();
      await waitForLoadingComplete(page);
      throw new Error(`icon-${healthStatus} not found yet`);
    }
    await expect(icon.first()).toBeVisible();
  }).toPass({ intervals: [10_000], timeout: 90_000 });
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
      // Cypress: any strong in the health tooltip may match; degraded/failure tooltips
      // also include legend <strong> labels — assert on the tooltip text as a whole.
      await expect(tooltip).toContainText(healthStatus, { timeout: 5_000 });
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
  await expect(page.getByRole('tooltip')).toContainText(healthStatus, { timeout: 60_000 });
};

type SortOrder = 'ascending' | 'descending';

export const expectTableHeadings = async (page: Page, headings: string[]): Promise<void> => {
  await expect(page.locator('table')).toBeVisible();
  for (const heading of headings) {
    await expect(page.locator(`th[data-label="${heading}"]`)).toBeVisible();
  }
};

export const sortListByColumn = async (page: Page, column: string, order: SortOrder): Promise<void> => {
  const header = page.locator(`th[data-label="${column}"]`);
  const currentSort = await header.getAttribute('aria-sort');
  if (currentSort === order) {
    return;
  }

  if (!currentSort || currentSort === 'none') {
    await header.locator('button').click();
    if (order === 'ascending') {
      await expect(header).toHaveAttribute('aria-sort', 'ascending');
      return;
    }
    await header.locator('button').click();
    await expect(header).toHaveAttribute('aria-sort', 'descending');
    return;
  }

  if (currentSort === 'ascending' && order === 'descending') {
    await header.locator('button').click();
    await expect(header).toHaveAttribute('aria-sort', 'descending');
    return;
  }

  if (currentSort === 'descending' && order === 'ascending') {
    await header.locator('button').click();
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
  }
};

export const expectListSortedByColumn = async (page: Page, column: string, order: SortOrder): Promise<void> => {
  const rows = page.locator('tbody tr');
  const rowCount = await rows.count();
  for (let i = 0; i < rowCount - 1; i++) {
    const current = await rows.nth(i).locator(`td[data-label="${column}"]`).innerText();
    const next = await rows
      .nth(i + 1)
      .locator(`td[data-label="${column}"]`)
      .innerText();
    const comparison = current.localeCompare(next);
    if (order === 'ascending') {
      expect(comparison).toBeLessThanOrEqual(0);
    } else {
      expect(comparison).toBeGreaterThanOrEqual(0);
    }
  }
};

export const expectTableColumnOrder = async (page: Page, expectedOrder: string[]): Promise<void> => {
  const headers = page.locator('table thead th[data-label]');
  const count = await headers.count();
  const actualOrder: string[] = [];
  for (let i = 0; i < count; i++) {
    const label = await headers.nth(i).getAttribute('data-label');
    if (label) {
      actualOrder.push(label);
    }
  }

  // Revision column appears when the mesh has multiple Istio revisions; Cypress CI often omits it.
  if (actualOrder.length === expectedOrder.length + 1 && actualOrder[actualOrder.length - 1] === 'Revision') {
    expect(actualOrder.slice(0, expectedOrder.length)).toEqual(expectedOrder);
    return;
  }

  expect(actualOrder).toEqual(expectedOrder);
};

const normalizeNamespaceColumn = (column: string): string => {
  if (column === 'Istio config') {
    return 'Config';
  }
  return column;
};

export const expectColumnNotEmptyOnRow = async (page: Page, rowText: string, column: string): Promise<void> => {
  const normalized = normalizeNamespaceColumn(column);
  const cell = getColWithRowText(page, rowText, normalized);
  if (normalized === 'Config') {
    await expect(cell.locator('[data-test$="-validation"]')).toBeVisible();
    return;
  }
  await expect(cell).not.toHaveText(/^\s*$/);
};

export const expectColumnTextOnRow = async (
  page: Page,
  rowText: string,
  column: string,
  text: string
): Promise<void> => {
  await expect(getColWithRowText(page, rowText, column)).toContainText(text);
};

export const expectMtlsTooltipOnRow = async (page: Page, rowText: string, text: string): Promise<void> => {
  const cell = getColWithRowText(page, rowText, 'mTLS');
  await cell.locator('svg').first().hover();
  await expect(page.getByLabel('mTLS status')).toBeVisible();
  await expect(page.locator('.pf-v6-c-tooltip__content')).toContainText(text);
};

export const expectOnlyHealthyInTable = async (page: Page): Promise<void> => {
  const icons = page.locator('tbody td[data-label="Health"] span.pf-v6-c-icon');
  const count = await icons.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const className = await icons.nth(i).getAttribute('class');
    expect(className).toBeTruthy();
    expect(className!.includes('icon-healthy')).toBeTruthy();
  }
  await expect(
    page.locator(
      'tbody span[class*="icon-unhealthy"], tbody span[class*="icon-degraded"], tbody span[class*="icon-na"]'
    )
  ).toHaveCount(0);
};

export const expectServicesInTable = async (page: Page, result: 'nothing' | 'something' | string): Promise<void> => {
  if (result === 'nothing') {
    await expect(page.locator('tbody')).toContainText('No services found');
    return;
  }
  if (result === 'something') {
    await expect(page.locator('tbody')).not.toContainText('No services found');
    return;
  }
  await expect(page.locator('tbody').getByRole('row').filter({ hasText: result })).toBeVisible();
};

export const expectWorkloadsInTable = async (
  page: Page,
  result: 'no workloads' | 'workloads' | string
): Promise<void> => {
  if (result === 'no workloads') {
    await expect(page.locator('tbody')).toContainText('No workloads found');
    return;
  }
  if (result === 'workloads') {
    await expect(page.locator('tbody')).not.toContainText('No workloads found');
    return;
  }
  await expect(page.locator('tbody').getByRole('row').filter({ hasText: result })).toBeVisible();
};

export const expectAppsWithNameCount = async (page: Page, request: Page['request'], name: string): Promise<void> => {
  const response = await request.get('/api/clusters/apps');
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { applications: Array<{ name: string }> };
  const count = body.applications.filter(item => item.name.includes(name)).length;
  await expect(page.locator('tbody')).not.toContainText('No apps found');
  await expect(page.locator('tbody tr')).toHaveCount(count);
};
