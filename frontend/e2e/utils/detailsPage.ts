import { expect, type Page } from '@playwright/test';
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

export async function expectClusterBadge(page: Page, cluster: string): Promise<void> {
  await expect(
    page.locator('#pfbadge-C').locator('xpath=ancestor::li[1]').filter({ hasText: cluster }).first()
  ).toBeVisible();
}

export async function expectLinksContainCluster(page: Page, cluster: string): Promise<void> {
  await expect(
    page.locator(`a[href*="clusterName=${cluster}"], button[data-href*="clusterName=${cluster}"]`).first()
  ).toBeVisible();
}

export async function expectTrafficClusterColumns(page: Page): Promise<void> {
  await expect(page.locator('th[data-label="Cluster"]')).toHaveCount(2);
}

export async function expectEmptyTrafficTab(page: Page): Promise<void> {
  await openDetailsTab(page, 'Traffic');
  await expect(page.getByRole('heading', { name: 'No Inbound Traffic' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No Outbound Traffic' })).toBeVisible();
}

export async function expectEmptyMinigraph(page: Page): Promise<void> {
  await expect(page.locator('#MiniGraphCard')).toContainText('Empty Graph');
}

export async function expectNoTraces(page: Page): Promise<void> {
  await openDetailsTab(page, 'Traces');
  await expect(page.getByTestId('tracing-scatterplot')).toHaveCount(0);
  await expect(page.getByTestId('empty-traces')).toContainText('No trace results');
}

export async function expectMetricsChartsLoaded(
  page: Page,
  tab: 'Inbound Metrics' | 'Outbound Metrics',
  dashboardUrlPart: string
): Promise<void> {
  const responsePromise = page.waitForResponse(response => response.url().includes(dashboardUrlPart));
  await openDetailsTab(page, tab);
  await responsePromise;
  await expect(page.getByTestId('metrics-chart').first()).toBeVisible();
}

export async function expectMetricsChartsNoData(
  page: Page,
  tab: 'Inbound Metrics' | 'Outbound Metrics',
  dashboardUrlPart: string
): Promise<void> {
  const responsePromise = page.waitForResponse(response => response.url().includes(dashboardUrlPart));
  await openDetailsTab(page, tab);
  await responsePromise;
  const charts = page.getByTestId('metrics-chart');
  await expect(charts.first()).toBeVisible();
  const count = await charts.count();
  for (let i = 0; i < count; i++) {
    await expect(charts.nth(i)).toContainText('No data available');
  }
}
