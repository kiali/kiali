import { expect } from '@playwright/test';
import { linkSelector } from '../utils/linkSelector';
import {
  checkHealthIndicatorInTable,
  checkHealthStatusInTable,
  ensureObjectsInTable,
  expectHealthIconInRow,
  expectOnlyHealthyApps,
  expectOnlyRow,
  expectTableContainsRow,
  getColWithRowText,
  expectAppsWithNameCount
} from '../utils/table';
import { getClusterForSingleCluster } from '../utils/cluster';
import { ListPage } from './ListPage';

const DETAILS_APP = 'details';

export class AppsPage extends ListPage {
  constructor(page: ListPage['page']) {
    super(page, 'applications');
  }

  async expectBookinfoAppsListed(): Promise<void> {
    await ensureObjectsInTable(this.page, 'details', 'kiali-traffic-generator', 'productpage', 'ratings', 'reviews');
  }

  async expectAppsColumnInformation(): Promise<void> {
    await expectHealthIconInRow(this.page, DETAILS_APP);

    const nameCell = getColWithRowText(this.page, DETAILS_APP, 'Name');
    await expect(nameCell.locator(linkSelector(`/namespaces/bookinfo/applications/${DETAILS_APP}`))).toBeVisible();

    await expect(getColWithRowText(this.page, DETAILS_APP, 'Namespace')).toContainText('bookinfo');

    const labelsCell = getColWithRowText(this.page, DETAILS_APP, 'Labels');
    await expect(labelsCell).toContainText('app=details');
    await expect(labelsCell).toContainText('service=details');
    await expect(labelsCell).toContainText('version=v1');

    const detailsCell = getColWithRowText(this.page, DETAILS_APP, 'Details');
    await expect(detailsCell).toContainText('bookinfo-gateway');
    await expect(
      detailsCell.locator(linkSelector('/namespaces/bookinfo/istio/networking.istio.io/v1/Gateway/bookinfo-gateway'))
    ).toBeVisible();
  }

  async expectAllAppsTogglesChecked(): Promise<void> {
    await expect(this.getBySel('toggle-health')).toBeChecked();
    await expect(this.getBySel('toggle-istioResources')).toBeChecked();
    await this.expectColumn('Health', true);
    await this.expectColumn('Details', true);
  }

  async expectOnlyHealthyApps(): Promise<void> {
    await expectOnlyHealthyApps(this.page);
  }

  async expectOnlyAppsNamed(name: string): Promise<void> {
    await expectAppsWithNameCount(this.page, this.page.request, name);
  }

  async expectApplicationListedAs(
    namespace: string,
    app: string,
    healthStatus: 'healthy' | 'idle' | 'failure' | 'degraded'
  ): Promise<void> {
    const cluster = await getClusterForSingleCluster(this.page.request);
    await checkHealthIndicatorInTable(this.page, cluster, namespace, null, app, healthStatus);
  }

  async expectApplicationHealthStatus(namespace: string, app: string, healthStatus: string): Promise<void> {
    const cluster = await getClusterForSingleCluster(this.page.request);
    await checkHealthStatusInTable(this.page, cluster, namespace, null, app, healthStatus);
  }

  async expectRows(...names: string[]): Promise<void> {
    for (const name of names) {
      await expectTableContainsRow(this.page, name);
    }
  }

  async expectOnlyRow(name: string): Promise<void> {
    await expectOnlyRow(this.page, name);
  }

  async visitListForNamespace(namespace: string): Promise<void> {
    const appsRequest = this.page.waitForResponse(response => response.url().includes('/api/clusters/apps'));
    await this.openList({ namespaces: namespace });
    await appsRequest;
  }

  async expectHealthCacheEnabled(): Promise<void> {
    const response = await this.page.request.get('/api/test/metrics/health/cache');
    expect(response.ok()).toBeTruthy();
  }

  async recordHealthCacheMetrics(): Promise<HealthCacheMetrics> {
    const response = await this.page.request.get('/api/test/metrics/health/cache');
    expect(response.ok()).toBeTruthy();
    return (await response.json()) as HealthCacheMetrics;
  }

  async expectHealthCacheHitsIncreased(before: HealthCacheMetrics, minHits = 1): Promise<void> {
    const response = await this.page.request.get('/api/test/metrics/health/cache');
    expect(response.ok()).toBeTruthy();
    const after = (await response.json()) as HealthCacheMetrics;
    expect(after.healthCacheHits).toBeGreaterThanOrEqual(before.healthCacheHits + minHits);
  }

  async expectHealthStatusMetricsNotEmpty(): Promise<void> {
    const metrics = await this.fetchHealthStatusMetrics();
    expect(metrics.length).toBeGreaterThan(0);
  }

  async expectHealthStatusMetricForApp(namespace: string, appName: string, healthStatus: string): Promise<void> {
    const metrics = await this.fetchHealthStatusMetrics();
    const appMetric = metrics.find(
      metric => metric.healthType === 'app' && metric.name === appName && metric.namespace === namespace
    );
    expect(appMetric).toBeDefined();
    expect(healthStatusValueToString(appMetric!.value)).toBe(healthStatus);
  }

  private async fetchHealthStatusMetrics(): Promise<HealthStatusMetricItem[]> {
    const response = await this.page.request.get('/api/test/metrics/health/status');
    if (!response.ok()) {
      return [];
    }
    const body = (await response.json()) as { metrics?: HealthStatusMetricItem[] };
    return body.metrics ?? [];
  }
}

type HealthCacheMetrics = {
  healthCacheHits: number;
  healthCacheMisses: number;
};

type HealthStatusMetricItem = {
  cluster: string;
  healthType: string;
  name: string;
  namespace: string;
  value: number;
};

const healthStatusValueToString = (value: number): string => {
  switch (value) {
    case 0:
      return 'Healthy';
    case 1:
      return 'Not Ready';
    case 2:
      return 'Degraded';
    case 3:
      return 'Failure';
    default:
      return 'Unknown';
  }
};
