import { expect } from '@playwright/test';
import { getClusterForSingleCluster } from '../utils/cluster';
import {
  checkHealthIndicatorInTable,
  checkHealthStatusInTable,
  expectHealthIconInRow,
  expectOnlyHealthyInTable,
  expectOnlyRow,
  expectRowCount,
  expectWorkloadsInTable,
  getColWithRowText
} from '../utils/table';
import { linkSelector } from '../utils/linkSelector';
import { waitForLoadingComplete } from '../utils/transition';
import { ListPage } from './ListPage';

export class WorkloadsPage extends ListPage {
  constructor(page: ListPage['page']) {
    super(page, 'workloads');
  }

  async filterBy(filter: string, filterValue: string): Promise<void> {
    if (filter === 'App Label' || filter === 'Version Label') {
      await this.pauseRefresh();
    }
    await super.filterBy(filter, filterValue);
  }

  private async pauseRefresh(): Promise<void> {
    await this.page.locator('button#workload-list-refresh-toggle').click();
    await this.page.locator('button[id="0"]').click();
    await waitForLoadingComplete(this.page);
  }

  async expectBookinfoWorkloadsTableInfo(): Promise<void> {
    await this.expectTableHeadings(['Health', 'Name', 'Namespace', 'Type', 'Labels', 'Details']);
    await expect(this.page.locator('tbody').getByRole('row').filter({ hasText: 'details-v1' })).toBeVisible();
    await expectHealthIconInRow(this.page, 'details-v1');

    const nameCell = getColWithRowText(this.page, 'details-v1', 'Name');
    await expect(nameCell.locator(linkSelector('/namespaces/bookinfo/workloads/details-v1', 'endsWith'))).toBeVisible();

    await expect(getColWithRowText(this.page, 'details-v1', 'Namespace')).toContainText('bookinfo');

    const labelsCell = getColWithRowText(this.page, 'details-v1', 'Labels');
    await expect(labelsCell).toContainText('app=details');
    await expect(labelsCell).toContainText('version=v1');

    await expect(getColWithRowText(this.page, 'details-v1', 'Type')).toContainText('Deployment');
    await expect(getColWithRowText(this.page, 'details-v1', 'Details')).not.toContainText('Config Issues');
    await this.expectColumn('Cluster', false);
  }

  private async expectTableHeadings(headings: string[]): Promise<void> {
    await expect(this.page.locator('table')).toBeVisible();
    for (const heading of headings) {
      await expect(this.page.locator(`th[data-label="${heading}"]`)).toBeVisible();
    }
  }

  async expectAllWorkloadsTogglesChecked(): Promise<void> {
    await expect(this.getBySel('toggle-health')).toBeChecked();
    await expect(this.getBySel('toggle-istioResources')).toBeChecked();
    await this.expectColumn('Health', true);
    await this.expectColumn('Details', true);
  }

  async expectWorkloadsInTable(result: 'no workloads' | 'workloads' | string): Promise<void> {
    await expectWorkloadsInTable(this.page, result);
  }

  async expectOnlyHealthyWorkloads(): Promise<void> {
    await expectOnlyHealthyInTable(this.page);
  }

  async expectOnlyWorkloadsWithAppLabel(): Promise<void> {
    const regex = /app=|service\.istio\.io\/canonical-name=|app\.kubernetes\.io\/name=/;
    const rows = this.page.locator('tbody tr');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i).locator('td[data-label="Labels"]')).toContainText(regex);
    }
  }

  async expectOnlyWorkloadsWithVersionLabel(): Promise<void> {
    const regex = /version=|service\.istio\.io\/canonical-revision=|app\.kubernetes\.io\/version=/;
    const rows = this.page.locator('tbody tr');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i).locator('td[data-label="Labels"]')).toContainText(regex);
    }
  }

  async expectOnlyRow(name: string): Promise<void> {
    await expectOnlyRow(this.page, name);
  }

  async expectRowCount(count: number): Promise<void> {
    await expectRowCount(this.page, count);
  }

  async expectWorkloadListedAs(
    namespace: string,
    workload: string,
    healthStatus: 'healthy' | 'idle' | 'failure' | 'degraded'
  ): Promise<void> {
    const cluster = await getClusterForSingleCluster(this.page.request);
    await checkHealthIndicatorInTable(this.page, cluster, namespace, 'Deployment', workload, healthStatus);
  }

  async expectWorkloadHealthStatus(namespace: string, workload: string, healthStatus: string): Promise<void> {
    const cluster = await getClusterForSingleCluster(this.page.request);
    await checkHealthStatusInTable(this.page, cluster, namespace, 'Deployment', workload, healthStatus);
  }
}
