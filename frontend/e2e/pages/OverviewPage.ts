import { expect, type Locator } from '@playwright/test';
import { load } from 'js-yaml';
import { BasePage } from './BasePage';
import { linkSelector } from '../utils/linkSelector';
import { expectPathname, gotoConsolePage } from '../utils/navigation';
import { waitForLoadingComplete } from '../utils/transition';

const normalizeKialiPath = (pathname: string): string => {
  if (pathname.includes('/ossmconsole') || pathname.startsWith('/k8s/ns/')) {
    return pathname.replace(/\/ossmconsole$/, '').replace(/^\/k8s\/ns\//, '/namespaces/');
  }
  return pathname.replace(/^\/console/, '');
};

const parseUrlPathAndSearch = (href: string, baseURL: string): string => {
  try {
    const u = new URL(href, baseURL);
    return `${u.pathname}${u.search}`;
  } catch {
    return href;
  }
};

export class OverviewPage extends BasePage {
  private lastClickedServiceInsightsHref: string | undefined;

  async open(): Promise<void> {
    await gotoConsolePage(this.page, 'overview');
  }

  /** Navigate without waiting for loading to finish — use before asserting loading states with mocked APIs. */
  async openPending(): Promise<void> {
    await gotoConsolePage(this.page, 'overview', {}, { waitForLoad: false });
  }

  private controlPlanesCard(): Locator {
    return this.getBySel('control-planes-card');
  }

  private clustersCard(): Locator {
    return this.getBySel('clusters-card');
  }

  private dataPlanesCard(): Locator {
    return this.getBySel('data-planes-card');
  }

  private serviceInsightsCard(): Locator {
    return this.getBySel('service-insights-card');
  }

  private appsCard(): Locator {
    return this.getBySel('apps-card');
  }

  async waitForControlPlanesApi(): Promise<void> {
    await this.page.waitForResponse(
      response => response.url().includes('/api/mesh/controlplanes') && response.request().method() === 'GET'
    );
  }

  async waitForClustersApi(): Promise<void> {
    await this.page.waitForResponse(
      response => response.url().includes('/api/istio/status') && response.request().method() === 'GET'
    );
  }

  async waitForServiceInsightsApis(): Promise<void> {
    await Promise.all([
      this.page.waitForResponse(
        response => response.url().includes('/api/overview/metrics/services/latency') && response.ok()
      ),
      this.page.waitForResponse(
        response => response.url().includes('/api/overview/metrics/services/rates') && response.ok()
      ),
      this.page.waitForResponse(
        response => response.url().includes('/api/overview/metrics/services/throughput') && response.ok()
      )
    ]);
  }

  async waitForApplicationsApi(): Promise<void> {
    await this.page.waitForResponse(
      response => response.url().includes('/api/overview/metrics/apps/rates') && response.request().method() === 'GET'
    );
  }

  async waitForIstioConfigsApi(): Promise<void> {
    await this.page.waitForResponse(
      response => response.url().includes('/api/istio/config') && response.request().method() === 'GET'
    );
  }

  // ==================== Istio configs warnings ====================

  async openIstioConfigsWarningsPopover(): Promise<void> {
    await expect(this.getBySel('istio-configs-warnings')).toBeVisible();
    await this.getBySel('istio-configs-warnings').click();
    await expect(this.page.getByText('View warning Istio configs')).toBeVisible();
  }

  async clickPopoverAction(label: string): Promise<void> {
    await this.page.getByText(label, { exact: true }).click();
  }

  async expectIstioConfigListWithWarningFilters(): Promise<void> {
    await expectPathname(this.page, /\/(console|ossmconsole)\/istio$/);
    const url = new URL(this.page.url());
    const params = url.searchParams;
    expect(params.getAll('config')).toContain('Warning');
    expect(params.getAll('config')).toContain('Not Validated');
    expect(params.get('opLabel')).toBe('or');

    const urlNamespaces = Array.from(
      new Set(
        (params.get('namespaces') ?? '')
          .split(',')
          .map(n => n.trim())
          .filter(Boolean)
      )
    ).sort();

    const response = await this.page.request.get('/api/namespaces');
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as Array<{ name: string }>;
    const allNamespaces = Array.from(new Set(body.map(ns => ns.name))).sort();
    expect(urlNamespaces).toEqual(allNamespaces);
  }

  // ==================== Control planes card ====================

  async expectControlPlanesLoadingState(): Promise<void> {
    const card = this.controlPlanesCard();
    await expect(card.getByText('Fetching control plane data')).toBeVisible();
    await expect(card.getByText(/Control planes \(/)).toHaveCount(0);
    await expect(card.getByText('View Control planes')).toHaveCount(0);
  }

  async expectControlPlanesErrorState(): Promise<void> {
    const card = this.controlPlanesCard();
    await expect(card.getByText('Control planes could not be loaded')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Try Again' })).toBeVisible();
    await expect(card.getByText(/Control planes \(/)).toHaveCount(0);
    await expect(card.getByText('View Control planes')).toHaveCount(0);
  }

  async clickTryAgainInControlPlanesCard(): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      response => response.url().includes('/api/mesh/controlplanes') && response.request().method() === 'GET'
    );
    await this.controlPlanesCard().getByRole('button', { name: 'Try Again' }).click();
    await responsePromise;
  }

  async expectControlPlanesCount(count: number): Promise<void> {
    const card = this.controlPlanesCard();
    await expect(card.getByText(`Control planes (${count})`)).toBeVisible();
    await expect(card.getByText('View Control planes')).toBeVisible();
  }

  async openControlPlanesIssuesPopover(): Promise<void> {
    await expect(this.getBySel('control-planes-issues')).toBeVisible();
    await this.getBySel('control-planes-issues').click();
  }

  async clickControlPlaneLinkInPopover(istiodName: string): Promise<void> {
    await this.page.locator(linkSelector('/mesh')).filter({ hasText: istiodName }).click();
  }

  async expectMeshPageWithClusterFilter(clusterName: string): Promise<void> {
    await expectPathname(this.page, /\/(console|ossmconsole)\/mesh$/);
    const params = new URL(this.page.url()).searchParams;
    expect(params.get('meshHide')).toBe(`cluster!=${clusterName}`);
  }

  // ==================== Data planes card ====================

  async clickViewDataPlanes(): Promise<void> {
    await this.dataPlanesCard().getByTestId('data-planes-view').click();
  }

  async expectNamespacesPageWithDataPlaneFilter(): Promise<void> {
    await expectPathname(this.page, /\/(console|ossmconsole)\/namespaces$/);
    expect(new URL(this.page.url()).searchParams.get('type')).toBe('Data plane');
  }

  // ==================== Clusters card ====================

  async expectClustersLoadingState(): Promise<void> {
    const card = this.clustersCard();
    await expect(card.getByText('Fetching cluster data')).toBeVisible();
    await expect(card.getByText(/Clusters \(/)).toHaveCount(0);
    await expect(card.getByText('View Mesh')).toHaveCount(0);
  }

  async expectClustersErrorState(): Promise<void> {
    const card = this.clustersCard();
    await expect(card.getByText('Clusters could not be loaded')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Try Again' })).toBeVisible();
    await expect(card.getByText(/Clusters \(/)).toHaveCount(0);
    await expect(card.getByText('View Mesh')).toHaveCount(0);
  }

  async clickTryAgainInClustersCard(): Promise<void> {
    const successResponse = this.page.waitForResponse(
      response => response.url().includes('/api/istio/status') && response.ok()
    );
    await this.clustersCard().getByRole('button', { name: 'Try Again' }).click();
    await successResponse;
  }

  async expectClustersNoDataState(): Promise<void> {
    const card = this.clustersCard();
    await expect(card.getByText('Clusters (0)')).toBeVisible();
    await expect(card.getByText('–')).toBeVisible();
    await expect(card.getByText('View Mesh')).toBeVisible();
  }

  async expectClustersCountAndFooterLink(): Promise<void> {
    const card = this.clustersCard();
    await expect(card.getByText('Could not be loaded')).toHaveCount(0);
    await expect(this.getBySel('clusters-card-title')).toContainText('Clusters');
    await expect(card.getByText('View Mesh')).toBeVisible();
  }

  async clickViewMeshInClustersCard(): Promise<void> {
    await this.clustersCard().locator(linkSelector('/mesh')).click();
  }

  async expectMeshPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/mesh/);
  }

  // ==================== Service insights card ====================

  async expectServiceInsightsLoadingState(): Promise<void> {
    const card = this.serviceInsightsCard();
    await expect(card.getByText('Fetching service data')).toBeVisible();
    await expect(this.getBySel('service-insights-view-all-services')).toHaveCount(0);
  }

  async expectServiceInsightsErrorState(): Promise<void> {
    const card = this.serviceInsightsCard();
    await expect(card.getByText('Failed to load service data')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Try Again' })).toBeVisible();
    await expect(this.getBySel('service-insights-view-all-services')).toHaveCount(0);
  }

  async clickTryAgainInServiceInsightsCard(): Promise<void> {
    const responsePromise = this.waitForServiceInsightsApis();
    await this.serviceInsightsCard().getByRole('button', { name: 'Try Again' }).click();
    await responsePromise;
  }

  async expectServiceInsightsDataAndFooterLink(): Promise<void> {
    const card = this.serviceInsightsCard();
    await expect(card.getByText('Fetching service data')).toHaveCount(0);
    await expect(card.getByText('Failed to load service data')).toHaveCount(0);
    await expect(this.getBySel('service-insights-view-all-services')).toBeVisible();

    const rates = card.getByTestId('service-insights-rates');
    const latencies = card.getByTestId('service-insights-latencies');
    const traffic = card.getByTestId('service-insights-traffic');
    const sectionCount = (await rates.count()) + (await latencies.count()) + (await traffic.count());
    expect(sectionCount).toBeGreaterThan(0);

    if ((await rates.count()) > 0) {
      const rowCount = await rates.locator('table tbody tr').count();
      if (rowCount > 0) {
        await expect(rates.getByRole('columnheader', { name: 'Name' })).toBeVisible();
        await expect(rates.getByRole('columnheader', { name: 'Errors' })).toBeVisible();
        const firstRow = rates.locator('tbody tr').first();
        await expect(firstRow.locator(linkSelector('/services/'))).toBeVisible();
        await expect(firstRow).toContainText('%');
      } else {
        await expect(rates.getByText('not available')).toBeVisible();
      }
    }

    if ((await latencies.count()) > 0) {
      await expect(latencies.getByRole('columnheader', { name: 'Name' })).toBeVisible();
      await expect(latencies.getByRole('columnheader', { name: 'Latency' })).toBeVisible();
      const rowCount = await latencies.locator('tbody tr').count();
      if (rowCount > 0) {
        const firstRow = latencies.locator('tbody tr').first();
        await expect(firstRow.locator(linkSelector('/services/'))).toBeVisible();
        await expect(firstRow).toContainText(/ms|s/);
      }
    }
  }

  async expectServiceInsightsMockDataTables(): Promise<void> {
    const card = this.serviceInsightsCard();
    await expect(card.getByText('Fetching service data')).toHaveCount(0);
    await expect(card.getByText('Failed to load service data')).toHaveCount(0);
    await expect(this.getBySel('service-insights-view-all-services')).toBeVisible();

    const rates = this.getBySel('service-insights-rates');
    await expect(rates.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(rates.getByRole('columnheader', { name: 'Errors' })).toBeVisible();
    await expect(rates.locator('tbody tr')).toHaveCount(2);
    const firstRow = rates.locator('tbody tr').first();
    await expect(firstRow.locator(linkSelector('/services/'))).toBeVisible();
    await expect(firstRow).toContainText('%');
  }

  async clickViewAllServicesInServiceInsightsCard(): Promise<void> {
    await expect(this.getBySel('service-insights-view-all-services')).toBeVisible();
    await this.getBySel('service-insights-view-all-services').click();
  }

  async expectServicesListWithAllNamespacesAndSorting(): Promise<void> {
    await expectPathname(this.page, /\/(console|ossmconsole)\/services$/);
    const params = new URL(this.page.url()).searchParams;
    expect(params.get('direction')).toBe('asc');
    expect(params.get('sort')).toBe('he');

    const urlNamespaces = Array.from(
      new Set(
        (params.get('namespaces') ?? '')
          .split(',')
          .map(n => n.trim())
          .filter(Boolean)
      )
    ).sort();
    expect(urlNamespaces.length).toBeGreaterThan(0);

    const response = await this.page.request.get('/api/namespaces');
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as Array<{ name: string }>;
    const allNamespaces = Array.from(new Set(body.map(ns => ns.name))).sort();
    expect(urlNamespaces).toEqual(allNamespaces);
  }

  async clickValidServiceInsightsLink(): Promise<void> {
    this.lastClickedServiceInsightsHref = undefined;
    const card = this.serviceInsightsCard();
    await expect(async () => {
      const hasRateLink = (await card.getByTestId('service-insights-rates').locator(linkSelector()).count()) > 0;
      const hasLatencyLink = (await card.getByTestId('service-insights-latencies').locator(linkSelector()).count()) > 0;
      const hasEmptyState = (await card.getByText('not available').count()) > 0;
      expect(hasRateLink || hasLatencyLink || hasEmptyState).toBe(true);
    }).toPass();

    const hasRateLink = (await card.getByTestId('service-insights-rates').locator(linkSelector()).count()) > 0;
    const hasLatencyLink = (await card.getByTestId('service-insights-latencies').locator(linkSelector()).count()) > 0;

    if (!hasRateLink && !hasLatencyLink) {
      await expect(card.getByText('not available')).toBeVisible();
      return;
    }

    const container = hasRateLink
      ? card.getByTestId('service-insights-rates')
      : card.getByTestId('service-insights-latencies');

    const links = container.locator(linkSelector());
    const hrefs = Array.from(
      new Set(
        await links.evaluateAll(elements =>
          elements
            .map(el => el.getAttribute('href') ?? el.getAttribute('data-href') ?? '')
            .map(h => h.trim())
            .filter(Boolean)
        )
      )
    );

    const baseURL = this.page.url();
    for (let idx = 0; idx < hrefs.length; idx++) {
      const href = hrefs[idx];
      this.lastClickedServiceInsightsHref = parseUrlPathAndSearch(href, baseURL);

      const detailResponse = this.page.waitForResponse(
        response =>
          response.url().includes('/api/namespaces/') &&
          response.url().includes('/services/') &&
          response.request().method() === 'GET'
      );

      await card.locator(linkSelector(href)).first().click();
      await expect(this.page).toHaveURL(/\/services\//, { timeout: 40_000 });
      const response = await detailResponse;
      if (response.status() < 400) {
        await this.waitForLoad();
        return;
      }

      await this.page.goBack();
      await this.waitForLoad();
      await expectPathname(this.page, /\/(console|ossmconsole)\/overview$/);
      await expect(card).toBeVisible();
    }

    throw new Error('No valid Service Insights service link found (all navigations ended in an error page).');
  }

  async expectServiceDetailsPageFromInsightsLink(): Promise<void> {
    if (!this.lastClickedServiceInsightsHref) {
      return;
    }

    const actualUrl = new URL(this.page.url());
    const expectedUrl = new URL(this.lastClickedServiceInsightsHref, actualUrl.origin);
    expect(normalizeKialiPath(actualUrl.pathname)).toBe(normalizeKialiPath(expectedUrl.pathname));
    expectedUrl.searchParams.forEach((value, key) => {
      expect(actualUrl.searchParams.get(key), `query param ${key}`).toBe(value);
    });

    const tabs = this.page.locator('#basic-tabs');
    await expect(tabs).toBeVisible();
    await expect(tabs.getByRole('tab', { name: 'Overview' })).toBeVisible();
    await expect(tabs.getByRole('tab', { name: 'Traffic' })).toBeVisible();
    await expect(tabs.getByRole('tab', { name: 'Inbound Metrics' })).toBeVisible();
  }

  // ==================== Applications card ====================

  async expectApplicationsLoadingState(): Promise<void> {
    const card = this.appsCard();
    await expect(card.getByText('Fetching applications data')).toBeVisible();
    await expect(this.getBySel('apps-card-view-all')).toHaveCount(0);
  }

  async expectApplicationsErrorState(): Promise<void> {
    const card = this.appsCard();
    await expect(card.getByText('Failed to load applications data')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Try Again' })).toBeVisible();
    await expect(this.getBySel('apps-card-view-all')).toHaveCount(0);
  }

  async clickTryAgainInApplicationsCard(): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      response => response.url().includes('/api/overview/metrics/apps/rates') && response.request().method() === 'GET'
    );
    await this.appsCard().getByRole('button', { name: 'Try Again' }).click();
    await responsePromise;
  }

  async expectApplicationsDataAndFooterLink(): Promise<void> {
    const card = this.appsCard();
    await expect(card.getByText('Fetching applications data')).toHaveCount(0);
    await expect(card.getByText('Failed to load applications data')).toHaveCount(0);
    await expect(this.getBySel('apps-card-view-all')).toBeVisible();
  }

  async clickViewAllApplications(): Promise<void> {
    await expect(this.getBySel('apps-card-view-all')).toBeVisible();
    await this.getBySel('apps-card-view-all').click();
  }

  async expectApplicationsListWithAllNamespaces(): Promise<void> {
    await expectPathname(this.page, /\/(console|ossmconsole)\/applications$/);
    const params = new URL(this.page.url()).searchParams;
    const urlNamespaces = Array.from(
      new Set(
        (params.get('namespaces') ?? '')
          .split(',')
          .map(n => n.trim())
          .filter(Boolean)
      )
    ).sort();
    expect(urlNamespaces.length).toBeGreaterThan(0);

    const response = await this.page.request.get('/api/namespaces');
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as Array<{ name: string }>;
    const allNamespaces = Array.from(new Set(body.map(ns => ns.name))).sort();
    expect(urlNamespaces).toEqual(allNamespaces);
  }

  async expectApplicationsMockRateData(): Promise<void> {
    const card = this.appsCard();
    await expect(card.getByText('Fetching applications data')).toHaveCount(0);
    await expect(card.getByText('Failed to load applications data')).toHaveCount(0);
    await expect(this.getBySel('apps-card-view-all')).toBeVisible();

    const rates = this.getBySel('apps-card-rates');
    await expect(rates.getByText('Inbound')).toBeVisible();
    await expect(rates).toContainText('RPS');
    await expect(rates.getByText('Outbound')).toBeVisible();
    await expect(rates.getByText('apps with no traffic')).toBeVisible();

    await expect(this.getBySel('apps-card-health').getByText('Total applications')).toBeVisible();
  }

  // ==================== Help / user menu (existing smoke tests) ====================

  async openHelpMenu(): Promise<void> {
    await this.getBySel('about-help-button').click();
  }

  async openAbout(): Promise<void> {
    await this.page.getByRole('menuitem', { name: 'About' }).click();
  }

  async openHelpAndAbout(): Promise<void> {
    await this.openHelpMenu();
    await this.openAbout();
  }

  async expectHelpMenuOptions(options: string[]): Promise<void> {
    for (const option of options) {
      await expect(this.page.getByRole('menuitem', { name: option })).toBeVisible();
    }
  }

  async openHelpMenuItem(title: string): Promise<void> {
    await this.page.getByRole('menuitem', { name: title }).click();
  }

  async expectModalTitle(title: string): Promise<void> {
    await expect(this.page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
  }

  async expectDebugInfoClusterCount(expected: number): Promise<void> {
    const row = this.page
      .locator('tr')
      .filter({ has: this.page.locator('td[data-label="Attribute"]', { hasText: 'clusters' }) });
    const valueCell = row.locator('td[data-label="Value"]');
    await expect(valueCell).toBeVisible();
    const yamlText = (await valueCell.innerText()).trim();
    const parsed = load(yamlText) as Record<string, unknown>;
    expect(Object.keys(parsed).length).toBe(expected);
  }

  async expectMeshLinkInAboutDialog(): Promise<void> {
    await expect(this.page.locator('div[role="dialog"] #mesh')).toBeVisible();
  }

  async refreshAndExpectNoIstioComponentStatus(): Promise<void> {
    await expect(async () => {
      const statusResponse = this.page.waitForResponse(
        response =>
          response.url().includes('/api/istio/status') && response.request().method() === 'GET' && response.ok()
      );
      await waitForLoadingComplete(this.page);
      await this.getBySel('refresh-button').click();
      await statusResponse;
      await waitForLoadingComplete(this.page);

      const warningCount = await this.getBySel('istio-status-warning').count();
      const dangerCount = await this.getBySel('istio-status-danger').count();
      if (warningCount > 0 || dangerCount > 0) {
        throw new Error(`Istio status alerts visible (warning=${warningCount}, danger=${dangerCount})`);
      }
    }).toPass({ intervals: [5_000], timeout: 60_000 });
  }

  async openUserDropdown(): Promise<void> {
    await this.getBySel('user-dropdown').click();
  }

  async logout(): Promise<void> {
    const logoutResponse = this.page.waitForResponse(response => response.url().includes('/api/logout'));
    await this.getBySel('user-logout').click();
    const response = await logoutResponse;
    expect(response.status()).toBe(204);
  }
}
