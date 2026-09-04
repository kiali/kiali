import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { gotoConsolePage } from '../utils/navigation';
import { waitForLoadingComplete } from '../utils/transition';

const isOssmc = (): boolean => process.env.PLAYWRIGHT_OSSMC === 'true';

type ServiceAction = 'delete_traffic_routing' | 'k8s_grpc_request_routing' | 'k8s_request_routing' | 'request_routing';

export class ServiceDetailsPage extends BasePage {
  async open(namespace: string, service: string): Promise<void> {
    await gotoConsolePage(this.page, `namespaces/${namespace}/services/${service}`);
  }

  async clickServiceAction(action: ServiceAction): Promise<void> {
    await waitForLoadingComplete(this.page);

    if (isOssmc()) {
      await this.page.waitForResponse(
        response =>
          response.url().includes('/api/') && response.url().includes('/services/') && response.url().includes('/graph')
      );
      await this.page.locator('button#minigraph-toggle').click();
    } else {
      await this.getBySel('service-actions-toggle').click();
      await waitForLoadingComplete(this.page);
    }

    await this.page.locator(`li[data-test="${action}"]`).locator('button').click();
    await waitForLoadingComplete(this.page);
  }

  async expectIstioConfigTableRowCount(count: number): Promise<void> {
    const table = this.page.locator('table[aria-label="Istio Config List"]');
    await expect(async () => {
      await this.page.reload();
      await waitForLoadingComplete(this.page);
      await expect(table.locator('tbody tr')).toHaveCount(count);
    }).toPass({ intervals: [2_000], timeout: 60_000 });
  }

  async expectIstioConfigTableEmpty(): Promise<void> {
    const table = this.page.locator('table[aria-label="Istio Config List"]');
    await expect(table.getByTestId('istio-config-empty')).toBeVisible();
  }

  async clickIstioConfigBadgeLink(badge: string, name = 'reviews'): Promise<void> {
    const table = this.page.locator('table[aria-label="Istio Config List"]');
    const row = table.locator('tbody tr').filter({ hasText: name }).filter({ hasText: badge });
    await row.getByRole('link', { name }).click();
    await waitForLoadingComplete(this.page);
  }

  async expectServiceReference(namespace: string, name: string): Promise<void> {
    await expect(this.getBySel(`service-${namespace}-${name}`)).toBeVisible();
  }
}
