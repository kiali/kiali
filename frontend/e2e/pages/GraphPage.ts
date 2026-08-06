import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { waitForLoadingComplete } from '../utils/transition';

export class GraphPage extends BasePage {
  /**
   * Visit graph with prometheus.enabled=false mocked via the config API route.
   * Replaces Cypress "prometheus is reported as disabled in the config".
   */
  async openWithPrometheusDisabled(): Promise<void> {
    await this.page.route('**/api/config', async route => {
      const response = await route.fetch();
      const body = await response.json();
      body.prometheus = {
        ...body.prometheus,
        enabled: false,
        disabledReason: ''
      };
      await route.fulfill({ response, json: body });
    });

    await this.page.goto('/console/graph/namespaces?refresh=0');
    await waitForLoadingComplete(this.page);
  }

  async expectPrometheusDisabledEmptyState(): Promise<void> {
    await expect(this.page.locator('#empty-graph-prometheus-disabled')).toBeVisible();
  }
}
