import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { gotoConsolePage } from '../utils/navigation';
import { expectClusterColumnHidden, openDetailsTab } from '../utils/detailsPage';
import { expectMiniGraphReady } from '../utils/graphTopology';
import { waitForLoadingComplete } from '../utils/transition';

const isOssmc = (): boolean => process.env.PLAYWRIGHT_OSSMC === 'true';

type ServiceAction = 'delete_traffic_routing' | 'k8s_grpc_request_routing' | 'k8s_request_routing' | 'request_routing';

const INBOUND_METRIC_GRAPHS = [
  'Request volume',
  'Request duration',
  'Request size',
  'Response size',
  'Request throughput',
  'Response throughput',
  'gRPC received',
  'gRPC sent',
  'TCP opened',
  'TCP closed',
  'TCP received',
  'TCP sent'
] as const;

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

  async expectTabs(...tabs: string[]): Promise<void> {
    const tabList = this.page.locator('#basic-tabs');
    for (const tab of tabs) {
      const roleTab = tabList.getByRole('tab', { name: tab, exact: true });
      if ((await roleTab.count()) > 0) {
        await expect(roleTab).toBeVisible();
      } else {
        await expect(tabList.locator('.pf-v6-c-tabs__list button').filter({ hasText: tab })).toBeVisible();
      }
    }
  }

  async expectServiceActionsMenu(): Promise<void> {
    if (isOssmc()) {
      await this.page.waitForResponse(
        response =>
          response.url().includes('/api/') && response.url().includes('/services/') && response.url().includes('/graph')
      );
      await this.page.locator('button#minigraph-toggle').click();
    } else {
      await this.getBySel('service-actions-toggle').click();
    }
    await expect(this.getBySel('request_routing')).toContainText('Request Routing');
  }

  async expectDetailsForService(name: string, version: string): Promise<void> {
    const resources = this.getBySel('service-resources-card');
    await expect(resources.locator('#pfbadge-A').locator('xpath=ancestor::li[1]')).toContainText(name);
    await expect(resources.locator('#pfbadge-W').locator('xpath=ancestor::li[1]')).toContainText(`${name}-${version}`);
    await expect(resources.locator('#pfbadge-C')).toHaveCount(0);
  }

  async expectResourcesCard(): Promise<void> {
    await expect(this.getBySel('service-resources-card')).toBeVisible();
  }

  async expectNetworkCard(): Promise<void> {
    const card = this.page.locator('#ServiceNetworkCard');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Service IP');
    await expect(card).toContainText('Hostnames');
  }

  async expectIstioConfigCard(): Promise<void> {
    const card = this.page.locator('#IstioConfigCard');
    await expect(card.locator('#pfbadge-G')).toBeVisible();
    await expect(card.locator('#pfbadge-VS')).toBeVisible();
  }

  async expectLabelsCard(): Promise<void> {
    await expect(this.getBySel('service-labels-card')).toBeVisible();
  }

  async expectAnnotationsCard(): Promise<void> {
    await expect(this.getBySel('service-annotations-card')).toBeVisible();
  }

  async expectTrafficInformation(): Promise<void> {
    await openDetailsTab(this.page, 'Traffic');
    const trafficCard = this.page.locator('.pf-v6-c-card__body').filter({ hasText: 'Inbound Traffic' });
    await expect(trafficCard.getByText('Inbound Traffic')).toBeVisible();
    await expect(trafficCard.getByText('No Inbound Traffic')).toHaveCount(0);
    await expect(this.page.getByText('Outbound Traffic')).toBeVisible();
    await expect(this.page.getByText('No Outbound Traffic')).toHaveCount(0);
    const inbound = this.page.getByRole('grid', { name: 'Inbound Traffic List' });
    const outbound = this.page.getByRole('grid', { name: 'Outbound Traffic List' });
    await expect(inbound).toBeVisible();
    await expect(outbound).toBeVisible();
    await expect(async () => {
      const inboundText = (await inbound.textContent()) ?? '';
      if (!/ingressgateway/i.test(inboundText)) {
        await this.getBySel('refresh-button').click();
        await waitForLoadingComplete(this.page);
        await openDetailsTab(this.page, 'Traffic');
        throw new Error('istio-ingressgateway not visible in inbound traffic yet');
      }
      await expect(inbound).toContainText(/ingressgateway/i);
    }).toPass({ intervals: [10_000], timeout: 120_000 });
    await expectClusterColumnHidden(this.page);
  }

  async expectInboundMetricGraphs(): Promise<void> {
    const responsePromise = this.page.waitForResponse(response =>
      response.url().includes('/api/namespaces/bookinfo/services/productpage/dashboard')
    );
    await openDetailsTab(this.page, 'Inbound Metrics');
    await responsePromise;
    for (const graph of INBOUND_METRIC_GRAPHS) {
      await expect(this.page.getByText(graph, { exact: true })).toBeVisible();
    }
  }

  async expectInboundMetricGraphHasData(graphName: string): Promise<void> {
    await openDetailsTab(this.page, 'Inbound Metrics');
    const graph = this.page.getByText(graphName, { exact: true });
    await expect(graph).toBeVisible();
    await expect(graph.locator('..').locator('..').locator('..')).not.toContainText('No data available');
  }

  async expectMinigraphVisible(): Promise<void> {
    await expect(this.page.locator('#MiniGraphCard')).toBeVisible();
    await expectMiniGraphReady(this.page);
  }

  async chooseShowNodeGraph(): Promise<void> {
    await this.page.locator('#minigraph-toggle').click();
    await this.page.getByText('Show node graph').click();
  }

  async expectGraphTypeDisabled(): Promise<void> {
    await expect(this.page.locator('button#graph_type_dropdown-toggle')).toBeDisabled();
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
    await expect(row).toHaveCount(1);
    // Cypress: cy.contains('div', badge).siblings().first().click()
    await row.locator('div').filter({ hasText: badge }).locator('xpath=following-sibling::*[1]').click();
    await waitForLoadingComplete(this.page);
  }

  async expectServiceReference(namespace: string, name: string): Promise<void> {
    await expect(this.getBySel(`service-${namespace}-${name}`)).toBeVisible();
  }
}
