import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { gotoConsolePage } from '../utils/navigation';
import { expectClusterColumnHidden, openDetailsTab } from '../utils/detailsPage';
import { expectDetailsTrafficTab } from '../utils/detailsTraffic';
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

  /**
   * Check a logs-tab container by input id (e.g. `ztunnel-ratings`, `waypoint-ratings`, `container-ratings`).
   *
   * For sparse ambient/proxy logs, pass `bodyMustInclude` so we wait for a matching `/pods/.../logs`
   * response that actually carries that text (not just HTTP 200). Retries re-toggle this checkbox
   * to re-fetch — do not use a blind toolbar refresh.
   *
   * Reuse for:
   * - ambient ztunnel: `selectContainer('ztunnel-ratings', { bodyMustInclude: 'ztunnel' })`
   * - waypoint (when ported): `selectContainer('waypoint-ratings', { bodyMustInclude: '...' })`
   *
   * `logType` is inferred from the id prefix (`ztunnel-` / `waypoint-`) unless overridden.
   */
  async selectContainer(
    containerId: string,
    options?: {
      /** Wait until a pod-logs response body (raw or entry message) includes this substring. */
      bodyMustInclude?: string;
      /** Override inferred `logType` query param filter (`ztunnel`, `waypoint`, `app`, `proxy`). */
      logType?: string;
    }
  ): Promise<void> {
    const checkbox = this.getBySel('workload-logs-pod-containers').locator(`input#${containerId}`);
    const bodyMustInclude = options?.bodyMustInclude;
    const logType =
      options?.logType ??
      (containerId.startsWith('ztunnel-') ? 'ztunnel' : containerId.startsWith('waypoint-') ? 'waypoint' : undefined);

    const matchesLogsResponse = async (response: {
      ok: () => boolean;
      text: () => Promise<string>;
      url: () => string;
    }): Promise<boolean> => {
      if (!/\/api\/namespaces\/[^/]+\/pods\/[^/]+\/logs/.test(response.url()) || !response.ok()) {
        return false;
      }
      if (logType && !response.url().includes(`logType=${logType}`)) {
        return false;
      }
      if (!bodyMustInclude) {
        return true;
      }
      const body = await response.text();
      if (body.includes(bodyMustInclude)) {
        return true;
      }
      try {
        const parsed = JSON.parse(body) as { entries?: { message?: string }[] };
        return (parsed.entries ?? []).some(entry => (entry.message ?? '').includes(bodyMustInclude));
      } catch {
        return false;
      }
    };

    const checkAndWaitForLogs = async (responseTimeoutMs?: number): Promise<void> => {
      const logsResponse = responseTimeoutMs
        ? this.page.waitForResponse(response => matchesLogsResponse(response), { timeout: responseTimeoutMs })
        : this.page.waitForResponse(response => matchesLogsResponse(response));
      await checkbox.check();
      await logsResponse;
      await waitForLoadingComplete(this.page);
    };

    if (!bodyMustInclude) {
      await checkAndWaitForLogs();
      return;
    }

    await expect(async () => {
      if (await checkbox.isChecked()) {
        await checkbox.uncheck();
        await waitForLoadingComplete(this.page);
      }
      await checkAndWaitForLogs(30_000);
    }).toPass({ intervals: [2_000, 5_000], timeout: 90_000 });
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

  /** At least one log line contains text. */
  async expectSomeLogLinesContain(text: string): Promise<void> {
    await expect(this.page.locator('#logsText p').filter({ hasText: text }).first()).toBeVisible();
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
    await expectDetailsTrafficTab(this.page, { expectEmptyOutbound: true });
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

  async expectPersesLinkInInboundMetrics(): Promise<void> {
    await openDetailsTab(this.page, 'Inbound Metrics');
    const cardBody = this.page.locator('.pf-v6-c-card__body');
    const link = cardBody.locator('#perses_link_0');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('title', 'Istio Mesh Dashboard');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toContainText('View in Perses');
    await expect(link).toHaveAttribute('href', /istio-mesh-dashboard/);
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

  async expectMinigraphOffline(): Promise<void> {
    const offline = this.getBySel('minigraph-offline');
    await expect(offline).toBeVisible();
    await expect(offline).toContainText('offline');
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

  async expectAmbientBadge(): Promise<void> {
    await expect(this.getBySel('workload-details-card').locator('.pf-v6-c-label__content')).toContainText('Ambient');
  }

  async expectMissingSidecarBadge(exists: boolean, namespace: string, workload: string): Promise<void> {
    const badge = this.getBySel(`missing-sidecar-badge-for-${workload}-workload-in-${namespace}-namespace`);
    if (exists) {
      await expect(badge).toBeVisible();
    } else {
      await expect(badge).toHaveCount(0);
    }
  }

  async expectModeInPopover(...texts: string[]): Promise<void> {
    await this.getBySel('details-mode').locator('svg').click();
    const dialog = this.page.getByRole('dialog', { name: 'Mode info' });
    await expect(dialog).toBeVisible();
    for (const text of texts) {
      await expect(dialog).toContainText(text);
    }
    await dialog.getByRole('button', { name: 'Close' }).first().click();
    await expect(dialog).toHaveCount(0);
  }

  async expectProtocolInPodPopover(value: string): Promise<void> {
    await this.getBySel('pod-info').first().click();
    const dialog = this.page.getByRole('dialog').filter({ hasText: 'Protocol' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(value);
    await dialog.getByRole('button', { name: 'Close' }).first().click();
    await expect(dialog).toHaveCount(0);
  }

  async expectL7WaypointLink(waypointName: string): Promise<void> {
    const resources = this.getBySel('workload-resources-card');
    await expect(resources).toContainText('L7');
    // data-test="waypoint-link" is on the KialiLink itself (not a wrapper).
    const link = this.getBySel('waypoint-link').filter({ hasText: waypointName });
    await expect(link).toBeVisible();
    await expect(link.locator('xpath=ancestor::li[1]').locator('span').filter({ hasText: 'L7' })).toBeVisible();
  }

  async clickL7WaypointLink(waypointName: string): Promise<void> {
    await this.getBySel('waypoint-link').filter({ hasText: waypointName }).click();
    await waitForLoadingComplete(this.page);
  }

  async expectWaypointAttribute(): Promise<void> {
    await expect(this.getBySel('details-waypoint')).toContainText('true');
  }

  async expectProxyStatusWithDetail(status: string, detail: string): Promise<void> {
    const proxyStatus = this.getBySel('proxy-status');
    await expect(proxyStatus.locator(`.icon-${status}`)).toBeVisible();
    await proxyStatus.hover();
    await expect(this.page.getByRole('tooltip')).toContainText(detail);
  }

  async expectIstioConfigEntry(configTestId: string, badgeId: string): Promise<void> {
    if (isOssmc()) {
      return;
    }
    const card = this.page.locator('#IstioConfigCard');
    await expect(card).toBeVisible();
    await expect(card.getByTestId(configTestId)).toBeVisible();
    await expect(card.locator(`#${badgeId}`)).toBeVisible();
  }

  async openWaypointTab(): Promise<void> {
    await openDetailsTab(this.page, 'Waypoint');
  }

  async openWaypointSubtab(subtab: string): Promise<void> {
    const tabs = this.page.locator('#waypoint-details');
    await expect(tabs).toBeVisible();
    const tabLocator = tabs.getByRole('tab', { name: subtab, exact: true });
    if ((await tabLocator.count()) > 0) {
      await tabLocator.click();
    } else {
      await tabs.locator('.pf-v6-c-tabs__list button').filter({ hasText: subtab }).click();
    }
    await waitForLoadingComplete(this.page);
  }

  async expectWaypointServicesData(): Promise<void> {
    await this.expectEnrolledWaypointTable({
      badgeId: 'pfbadge-S',
      labeledBy: 'namespace',
      name: 'productpage',
      namespace: 'bookinfo'
    });
  }

  async expectWaypointInfoFor(type: string): Promise<void> {
    await expect(this.getBySel('waypointfor-title')).toContainText(type);
    await expect(this.page.getByRole('grid').locator('td[data-label="RDS"]')).toContainText('IGNORED');
  }

  async expectNoL7WaypointLink(): Promise<void> {
    await expect(this.getBySel('workload-resources-card')).not.toContainText('L7');
  }

  async expectWaypointSubtabAbsent(subtab: string): Promise<void> {
    const tabs = this.page.locator('#waypoint-details');
    await expect(tabs).toBeVisible();
    await expect(tabs).not.toContainText(subtab);
  }

  async expectEnrolledWaypointTable(options: {
    badgeId: string;
    labeledBy: string;
    name: string;
    namespace: string;
    rows?: number;
  }): Promise<void> {
    const title = this.getBySel('enrolled-data-title');
    await expect(title).toBeVisible();
    const table = title.locator('xpath=following::table[1]');
    if (options.rows !== undefined) {
      await expect(table.locator('tbody tr')).toHaveCount(options.rows);
    }
    await expect(table.locator('td[data-label="Name"]').filter({ hasText: options.name }).first()).toBeVisible();
    await expect(table.locator(`#${options.badgeId}`).first()).toBeVisible();
    await expect(
      table.locator('td[data-label="Namespace"]').filter({ hasText: options.namespace }).first()
    ).toBeVisible();
    await expect(
      table.locator('td[data-label="Labeled by"]').filter({ hasText: options.labeledBy }).first()
    ).toBeVisible();
  }

  async expectProxyStatus(status: string): Promise<void> {
    const statusLabels: Record<string, string> = {
      degraded: 'Degraded',
      failure: 'Failure',
      healthy: 'Healthy',
      info: 'Info',
      na: 'n/a'
    };
    const label = statusLabels[status.toLowerCase()] ?? status;
    const detailsStatus = this.getBySel('details-status');
    await expect(detailsStatus).toContainText(label);
    await expect(detailsStatus.locator(`.icon-${status.toLowerCase()}`)).toBeVisible();
  }

  async expectProxyStatusIcon(status: string): Promise<void> {
    const card = this.getBySel('workload-details-card');
    await expect(card.locator(`span[class*="icon-${status.toLowerCase()}"]`)).toBeVisible();
  }

  async expectNoConfigIssues(): Promise<void> {
    const card = this.getBySel('workload-details-card');
    await expect(card).toBeVisible();
    await expect(card).not.toContainText('Config Issues');
  }

  async openZtunnelTab(): Promise<void> {
    await openDetailsTab(this.page, 'Ztunnel');
  }

  async expectZtunnelServicesTable(): Promise<void> {
    await this.openZtunnelTab();
    const tabs = this.page.locator('#ztunnel-details');
    await expect(tabs).toBeVisible();
    await tabs.getByText('Services', { exact: true }).click();
    const table = this.page.locator('table[aria-label="Ztunnel services config"]');
    await expect(table).toBeVisible();
    await expect(table.locator('th[data-label="Service VIP"]')).toBeVisible();
  }

  async expectZtunnelTabForNamespace(namespace: string): Promise<void> {
    await this.openZtunnelTab();
    const tabs = this.page.locator('#ztunnel-details');
    await expect(tabs).toBeVisible();
    await tabs.getByText('Services', { exact: true }).click();
    const grid = this.page.getByRole('grid');
    await expect(grid.locator('td[data-label="Service VIP"]').first()).toBeVisible();
    await expect(grid.locator('td[data-label="Waypoint"]').first()).toBeAttached();
    await expect(grid.locator('td[data-label="Namespace"]')).toContainText(namespace);

    await tabs.getByText('Workloads', { exact: true }).click();
    await expect(grid.locator('td[data-label="Pod Name"]').first()).toBeVisible();
    await expect(grid.locator('td[data-label="Node"]').first()).toBeAttached();
    await expect(grid.locator('td[data-label="Namespace"]')).toContainText(namespace);

    await this.page.locator('button#filter_select_type-toggle').click();
    await this.page
      .locator('div#filter_select_type button')
      .filter({ hasText: /^Namespace$/ })
      .click();
    const input = this.page.locator('input[placeholder="Filter by Namespace"]');
    await input.fill(namespace);
    await input.press('Enter');
    await this.page.locator(`li[label="${namespace}"]`).getByRole('button').click();
    await waitForLoadingComplete(this.page);

    const cells = this.page.locator('td[data-label="Namespace"]');
    const count = await cells.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(cells.nth(i)).toContainText(namespace);
    }
  }

  async setLogLevel(level: string): Promise<void> {
    await this.getBySel('log-actions-dropdown').click();
    await this.page.locator(`#setLogLevel${level}`).click();
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
