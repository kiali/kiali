import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { gotoConsolePage } from '../utils/navigation';
import { expectClusterColumnHidden, openDetailsTab } from '../utils/detailsPage';
import { expectMiniGraphReady } from '../utils/graphTopology';
import { waitForLoadingComplete } from '../utils/transition';

export class AppDetailsPage extends BasePage {
  async openApp(namespace: string, name: string): Promise<void> {
    await gotoConsolePage(this.page, `namespaces/${namespace}/applications/${name}`);
  }

  async expectDetailsForApp(name: string): Promise<void> {
    await expect(this.getBySel('app-details-card').getByTestId('details-status')).toContainText('Status');
    const resources = this.getBySel('app-resources-card');
    await expect(resources.locator('#pfbadge-W').locator('xpath=ancestor::li[1]')).toContainText(`${name}-v1`);
    await expect(resources.locator('#pfbadge-S').locator('xpath=ancestor::li[1]')).toContainText(name);
    await expect(resources.locator('#pfbadge-C')).toHaveCount(0);
  }

  async expectResourcesCard(): Promise<void> {
    await expect(this.getBySel('app-resources-card')).toBeVisible();
  }

  async expectTrafficInformation(): Promise<void> {
    await openDetailsTab(this.page, 'Traffic');
    await expect(async () => {
      await expect(this.page.getByText('Inbound Traffic')).toBeVisible();
      if ((await this.page.getByText('No Inbound Traffic').count()) > 0) {
        await this.getBySel('refresh-button').click();
        await waitForLoadingComplete(this.page);
        await openDetailsTab(this.page, 'Traffic');
        throw new Error('Inbound traffic not populated yet');
      }
      await expect(this.page.getByText('No Inbound Traffic')).toHaveCount(0);
      await expect(this.page.getByText('Outbound Traffic')).toBeVisible();
      await expect(this.page.getByText('No Outbound Traffic')).toHaveCount(0);
    }).toPass({ intervals: [10_000], timeout: 120_000 });
    await expectClusterColumnHidden(this.page);
  }

  async expectInboundMetrics(): Promise<void> {
    const responsePromise = this.page.waitForResponse(response =>
      response.url().includes('/api/namespaces/bookinfo/apps/details/dashboard')
    );
    await openDetailsTab(this.page, 'Inbound Metrics');
    await responsePromise;
    await expect(this.page.getByTestId('metrics-chart').first()).toBeVisible();
  }

  async expectOutboundMetrics(): Promise<void> {
    const responsePromise = this.page.waitForResponse(response =>
      response.url().includes('/api/namespaces/bookinfo/apps/details/dashboard')
    );
    await openDetailsTab(this.page, 'Outbound Metrics');
    await responsePromise;
    await expect(this.page.getByTestId('metrics-chart').first()).toBeVisible();
  }

  async expectMinigraphVisible(): Promise<void> {
    await expect(this.page.locator('#MiniGraphCard')).toBeVisible();
    await expectMiniGraphReady(this.page);
  }

  async expectUrlIncludes(text: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(text));
  }

  async expectUrlExcludes(text: string): Promise<void> {
    await expect(this.page).not.toHaveURL(new RegExp(text));
  }
}
