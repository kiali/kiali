import { expect } from '@playwright/test';
import { getClusterForSingleCluster } from '../utils/cluster';
import { checkHealthIndicatorInTable, checkHealthStatusInTable } from '../utils/table';
import { ListPage } from './ListPage';

export class ServicesPage extends ListPage {
  constructor(page: ListPage['page']) {
    super(page, 'services');
  }

  async expectAllTogglesChecked(): Promise<void> {
    await expect(this.getBySel('toggle-configuration')).toBeChecked();
    await expect(this.getBySel('toggle-health')).toBeChecked();
    await expect(this.getBySel('toggle-istioResources')).toBeChecked();
    await this.expectColumn('Configuration', true);
    await this.expectColumn('Health', true);
    await this.expectColumn('Details', true);
  }

  async expectServiceListedAs(
    namespace: string,
    service: string,
    healthStatus: 'healthy' | 'na' | 'failure' | 'degraded'
  ): Promise<void> {
    const cluster = await getClusterForSingleCluster(this.page.request);
    await checkHealthIndicatorInTable(this.page, cluster, namespace, null, service, healthStatus);
  }

  async expectServiceHealthStatus(namespace: string, service: string, healthStatus: string): Promise<void> {
    const cluster = await getClusterForSingleCluster(this.page.request);
    await checkHealthStatusInTable(this.page, cluster, namespace, null, service, healthStatus);
  }
}
