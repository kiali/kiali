import { expect } from '@playwright/test';
import { getClusterForSingleCluster } from '../utils/cluster';
import { kubectlExec } from '../utils/kubectl';
import { linkSelector } from '../utils/linkSelector';
import {
  checkHealthIndicatorInTable,
  checkHealthStatusInTable,
  expectHealthIconInRow,
  expectOnlyHealthyInTable,
  expectOnlyRow,
  expectRowCount,
  expectServicesInTable,
  getColWithRowText
} from '../utils/table';
import { waitForLoadingComplete } from '../utils/transition';
import { ListPage } from './ListPage';

export class ServicesPage extends ListPage {
  constructor(page: ListPage['page']) {
    super(page, 'services');
  }

  async applyProductpageKialiApiAnnotations(): Promise<void> {
    kubectlExec('kubectl annotate service productpage -n bookinfo kiali.io/api-type=rest --overwrite', false);
    kubectlExec(
      'kubectl annotate service productpage -n bookinfo kiali.io/api-spec=https://petstore.swagger.io/v2/swagger.json',
      false
    );
    const apiType = kubectlExec(
      'kubectl get service productpage -n bookinfo -o jsonpath="{.metadata.annotations.kiali\\.io/api-type}"'
    );
    if (apiType.stdout.trim() !== 'rest') {
      throw new Error(`productpage kiali.io/api-type annotation not applied (got "${apiType.stdout}")`);
    }
  }

  async expectBookinfoServicesTableInfo(): Promise<void> {
    await this.expectTableHeadings(['Health', 'Name', 'Namespace', 'Labels', 'Configuration', 'Details']);
    await expect(this.page.locator('tbody').getByRole('row').filter({ hasText: 'productpage' })).toBeVisible();
    await expectHealthIconInRow(this.page, 'productpage');

    const nameCell = getColWithRowText(this.page, 'productpage', 'Name');
    await expect(nameCell.locator(linkSelector('/namespaces/bookinfo/services/productpage', 'endsWith'))).toBeVisible();

    await expect(getColWithRowText(this.page, 'productpage', 'Namespace')).toContainText('bookinfo');

    const labelsCell = getColWithRowText(this.page, 'productpage', 'Labels');
    await expect(labelsCell).toContainText('app=productpage');
    await expect(labelsCell).toContainText('service=productpage');

    const configCell = getColWithRowText(this.page, 'productpage', 'Configuration');
    await expect(
      configCell.locator(linkSelector('/namespaces/bookinfo/services/productpage', 'endsWith'))
    ).toBeVisible();

    const detailsCell = getColWithRowText(this.page, 'productpage', 'Details');
    await expect(
      detailsCell.locator(
        linkSelector('/namespaces/bookinfo/istio/networking.istio.io/v1/VirtualService/bookinfo', 'endsWith')
      )
    ).toBeVisible();
    await expect(
      detailsCell.locator(
        linkSelector('/namespaces/bookinfo/istio/networking.istio.io/v1/Gateway/bookinfo-gateway', 'endsWith')
      )
    ).toBeVisible();
    const apiDocIcon = detailsCell.locator('img[title="API Documentation"]');
    await expect(async () => {
      const servicesResponse = this.page.waitForResponse(
        response =>
          response.url().includes('/api/clusters/services') && response.request().method() === 'GET' && response.ok()
      );
      await this.getBySel('refresh-button').click();
      await servicesResponse;
      await waitForLoadingComplete(this.page);
      if ((await apiDocIcon.count()) === 0) {
        throw new Error('API Documentation icon not visible yet');
      }
      await expect(apiDocIcon).toBeVisible();
    }).toPass({ intervals: [2_000], timeout: 60_000 });
    await this.expectColumn('Cluster', false);
  }

  private async expectTableHeadings(headings: string[]): Promise<void> {
    await expect(this.page.locator('table')).toBeVisible();
    for (const heading of headings) {
      await expect(this.page.locator(`th[data-label="${heading}"]`)).toBeVisible();
    }
  }

  async expectOnlyHealthyServices(): Promise<void> {
    await expectOnlyHealthyInTable(this.page);
  }

  async clickLabel(label: string): Promise<void> {
    await this.page.locator('tbody').getByText(label, { exact: true }).click();
    await waitForLoadingComplete(this.page);
  }

  async expectServicesInTable(result: 'nothing' | 'something' | string): Promise<void> {
    await expectServicesInTable(this.page, result);
  }

  async expectOnlyRow(name: string): Promise<void> {
    await expectOnlyRow(this.page, name);
  }

  async expectRowCount(count: number): Promise<void> {
    await expectRowCount(this.page, count);
  }

  async expectRowCountGreaterThan(count: number): Promise<void> {
    const rowCount = await this.page.locator('tbody tr').count();
    expect(rowCount).toBeGreaterThan(count);
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
