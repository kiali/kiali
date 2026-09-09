import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { gotoConsolePage } from '../utils/navigation';
import { expectClusterColumnHidden, openDetailsTab } from '../utils/detailsPage';
import { expectMiniGraphReady } from '../utils/graphTopology';
import { restartWorkload } from '../utils/sidecarInjection';
import { waitForLoadingComplete } from '../utils/transition';

const isOssmc = (): boolean => process.env.PLAYWRIGHT_OSSMC === 'true';

type SidecarAction = 'disable_auto_injection' | 'enable_auto_injection' | 'remove_auto_injection';

export class WorkloadDetailsPage extends BasePage {
  async open(namespace: string, workload: string): Promise<void> {
    await gotoConsolePage(this.page, `namespaces/${namespace}/workloads/${workload}`);
  }

  async openLogsTab(namespace: string, workload: string): Promise<void> {
    await gotoConsolePage(this.page, `namespaces/${namespace}/workloads/${workload}`, { tab: 'logs' });

    const changeIntervalDuration = async (): Promise<void> => {
      await this.page.locator('#metrics_filter_interval_duration-toggle').click();
      await this.page.locator('[id="3600"]').click();
    };

    if (isOssmc()) {
      await this.page.locator('#time_duration').click();
      await changeIntervalDuration();
      await this.page.locator('#time-duration-modal').getByRole('button', { name: 'Confirm' }).click();
    } else {
      await changeIntervalDuration();
    }

    await waitForLoadingComplete(this.page);
    await expect(this.page.locator('#logsText p').first()).toBeVisible();
  }

  async goToLogsTab(): Promise<void> {
    await this.getBySel('workload-details-logs-tab').click();
    await waitForLoadingComplete(this.page);
  }

  async expectContainerListed(containerName: string): Promise<void> {
    await expect(this.getBySel('workload-logs-pod-containers').getByText(containerName, { exact: true })).toBeVisible();
  }

  async expectContainerChecked(containerId: string): Promise<void> {
    await expect(this.getBySel('workload-logs-pod-containers').locator(`input#${containerId}`)).toBeChecked();
  }

  async expectPodSelected(podNamePrefix: string): Promise<void> {
    await expect(this.page.locator('#wpl_pods-toggle')).toContainText(podNamePrefix);
  }

  async setMaxLogLines(lines: number): Promise<void> {
    await this.page.locator('#wpl_maxLines-toggle').click();
    await this.page.locator(`[id="${lines}"]`).click();
  }

  async selectOnlyContainer(containerName: string): Promise<void> {
    const containers = this.getBySel('workload-logs-pod-containers');
    const checkboxes = containers.locator('[type=checkbox]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).uncheck();
    }
    await containers.locator(`input#container-${containerName}`).check();
  }

  async expectLogLineCountAtMost(maxPerContainer: number): Promise<void> {
    const checkedCount = await this.getBySel('workload-logs-pod-containers').locator('[type=checkbox]:checked').count();
    const lineCount = await this.page.locator('#logsText p').count();
    expect(lineCount).toBeLessThanOrEqual(checkedCount * maxPerContainer);
  }

  async expectLogsOnlyForContainer(containerName: string): Promise<void> {
    const label = this.getBySel('workload-logs-pod-containers').getByText(containerName, { exact: true });
    const logColor = await label.evaluate(el => (el as HTMLElement).style.color);
    const lines = this.page.locator('#logsText p');
    const count = await lines.count();
    for (let i = 0; i < count; i++) {
      const color = await lines.nth(i).evaluate(el => (el as HTMLElement).style.color);
      expect(color).toBe(logColor);
    }
  }

  async setLogShow(text: string): Promise<void> {
    await this.page.locator('#log_show').fill(text);
    await this.page.locator('#log_show').press('Enter');
  }

  async setLogHide(text: string): Promise<void> {
    await this.page.locator('#log_hide').fill(text);
    await this.page.locator('#log_hide').press('Enter');
  }

  async expectLogLinesContain(text: string): Promise<void> {
    const lines = this.page.locator('#logsText p');
    const count = await lines.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(lines.nth(i)).toContainText(text);
    }
  }

  async expectLogLinesNotContain(text: string): Promise<void> {
    const lines = this.page.locator('#logsText p');
    const count = await lines.count();
    for (let i = 0; i < count; i++) {
      await expect(lines.nth(i)).not.toContainText(text);
    }
  }

  async expectJsonLogLines(): Promise<void> {
    await expect(this.page.locator('#logsText').getByTestId('json-log-info-button').first()).toBeVisible();
  }

  async clickJsonLogLine(): Promise<void> {
    await this.page.locator('#logsText').getByTestId('json-log-info-button').first().click();
  }

  async expectParsedJsonValues(): Promise<void> {
    await this.getBySel('json-modal').getByTestId('json-table-tab').click();
    const firstRow = this.getBySel('parsed-json-table').locator('tr').first();
    await expect(firstRow.locator('td').nth(0)).toContainText('a');
    await expect(firstRow.locator('td').nth(1)).toContainText('b');
  }

  async expectWorkloadDetails(): Promise<void> {
    const resources = this.getBySel('workload-resources-card');
    await expect(resources.locator('#pfbadge-A').locator('xpath=ancestor::li[1]')).toContainText('details');
    await expect(resources.locator('#pfbadge-S').locator('xpath=ancestor::li[1]')).toContainText('details');
    await expect(resources.locator('#pfbadge-C')).toHaveCount(0);
  }

  async expectResourcesCard(): Promise<void> {
    await expect(this.getBySel('workload-resources-card')).toBeVisible();
  }

  async expectPodsCard(): Promise<void> {
    await expect(this.page.locator('#WorkloadPodsCard')).toBeVisible();
  }

  async expectIstioConfigCard(): Promise<void> {
    await expect(this.page.locator('#IstioConfigCard')).toBeVisible();
  }

  async expectLabelsCard(): Promise<void> {
    await expect(this.getBySel('workload-labels-card')).toBeVisible();
  }

  async expectAnnotationsCard(): Promise<void> {
    await expect(this.getBySel('workload-annotations-card')).toBeVisible();
  }

  async expectTrafficInformation(): Promise<void> {
    await openDetailsTab(this.page, 'Traffic');
    await expect(this.page.getByText('Inbound Traffic')).toBeVisible();
    await expect(this.page.getByText('No Inbound Traffic')).toHaveCount(0);
    await expect(this.page.getByText('No Outbound Traffic')).toBeVisible();
    await expectClusterColumnHidden(this.page);
  }

  async expectInboundMetrics(): Promise<void> {
    const responsePromise = this.page.waitForResponse(response =>
      response.url().includes('/api/namespaces/bookinfo/workloads/details-v1/dashboard')
    );
    await openDetailsTab(this.page, 'Inbound Metrics');
    await responsePromise;
    await expect(this.page.getByTestId('metrics-chart').first()).toBeVisible();
  }

  async expectOutboundMetrics(): Promise<void> {
    const responsePromise = this.page.waitForResponse(response =>
      response.url().includes('/api/namespaces/bookinfo/workloads/details-v1/dashboard')
    );
    await openDetailsTab(this.page, 'Outbound Metrics');
    await responsePromise;
    await expect(this.page.getByTestId('metrics-chart').first()).toBeVisible();
  }

  async expectMinigraphVisible(): Promise<void> {
    await expect(this.page.locator('#MiniGraphCard')).toBeVisible();
    await expectMiniGraphReady(this.page);
  }

  private async openEnvoyTab(tab: string): Promise<void> {
    await this.page.locator('#envoy-details').getByText(tab, { exact: true }).click();
  }

  async filterEnvoyTab(
    filter: string,
    value: string,
    tab: 'Bootstrap' | 'Clusters' | 'Config' | 'Listeners' | 'Routes'
  ): Promise<void> {
    await openDetailsTab(this.page, 'Envoy');
    await this.openEnvoyTab(tab);
    await this.page.locator('button#filter_select_type-toggle').click();
    await this.page
      .locator('div#filter_select_type button')
      .filter({ hasText: new RegExp(`^${filter}$`) })
      .click();
    await this.page.locator('input#filter_input_value').fill(value);
    await this.page.locator('input#filter_input_value').press('Enter');
  }

  async expectClustersTable(): Promise<void> {
    await expect(this.page.locator('tbody')).not.toContainText('BlackHoleCluster');
    await expect(this.page.locator('tbody')).toContainText('details.bookinfo.svc.cluster.local');
  }

  async expectListenersTable(): Promise<void> {
    await expect(this.page.locator('tbody')).not.toContainText('PassthroughCluster');
    await expect(this.page.locator('tbody')).toContainText(/Route:.*9090/);
  }

  async expectRoutesTable(): Promise<void> {
    await expect(this.page.locator('tbody')).not.toContainText('15010');
    await expect(this.page.locator('tbody')).toContainText('9080');
  }

  async openBootstrapTab(): Promise<void> {
    await openDetailsTab(this.page, 'Envoy');
    await this.openEnvoyTab('Bootstrap');
  }

  async openConfigTab(): Promise<void> {
    await openDetailsTab(this.page, 'Envoy');
    await this.openEnvoyTab('Config');
  }

  async expectBootstrapEditor(): Promise<void> {
    await expect(this.getBySel('envoy-editor').locator('.monaco-editor')).toBeVisible();
    await expect(this.getBySel('envoy-editor')).toContainText('bootstrap');
  }

  async expectConfigEditor(): Promise<void> {
    await expect(this.getBySel('envoy-editor').locator('.monaco-editor')).toBeVisible();
    await expect(this.getBySel('envoy-editor')).toContainText('config_dump');
  }

  async expectEnvoyMetrics(): Promise<void> {
    const responsePromise = this.page.waitForResponse(response =>
      response.url().includes('/api/namespaces/bookinfo/customdashboard/envoy')
    );
    await openDetailsTab(this.page, 'Envoy');
    await this.openEnvoyTab('Metrics');
    await responsePromise;
    await expect(this.page.getByText('Loading metrics')).toHaveCount(0);
    await expect(this.page.getByTestId('metrics-chart').first()).toBeVisible();
  }

  async openWorkloadActions(): Promise<void> {
    if (isOssmc()) {
      await this.page.waitForResponse(
        response =>
          response.url().includes('/api/') &&
          response.url().includes('/workloads/') &&
          response.url().includes('/graph')
      );
      await this.page.locator('button#minigraph-toggle').click();
    } else {
      await this.getBySel('workload-actions-toggle').click();
    }
  }

  async clickSidecarAction(action: SidecarAction): Promise<void> {
    await this.openWorkloadActions();
    await this.page.locator(`li[data-test=${action}]`).locator('button').click();
    await expect(this.page.locator('div.pf-v6-c-alert.pf-m-success')).toBeVisible();
  }

  async clickSidecarActionAndRestart(action: SidecarAction, namespace: string, workload: string): Promise<void> {
    await this.clickSidecarAction(action);
    await restartWorkload(namespace, workload);
    await this.open(namespace, workload);
    await waitForLoadingComplete(this.page);
  }

  async expectMissingSidecarBadge(exists: boolean, namespace: string, workload: string): Promise<void> {
    const badge = this.getBySel(`missing-sidecar-badge-for-${workload}-workload-in-${namespace}-namespace`);
    if (exists) {
      await expect(badge).toBeVisible();
    } else {
      await expect(badge).toHaveCount(0);
    }
  }

  async expectNoWorkloadInjectionLabel(): Promise<void> {
    const card = this.getBySel('workload-labels-card');
    const overflow = card.locator('.pf-m-overflow');
    if ((await overflow.count()) > 0) {
      await overflow.click();
    }
    await expect(card.getByTestId('sidecar.istio.io/inject-label-container')).toHaveCount(0);
  }
}
