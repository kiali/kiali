import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { gotoConsolePage } from '../utils/navigation';
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
      // IDs starting with a digit are invalid CSS selectors (#3600); use attribute selector.
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
