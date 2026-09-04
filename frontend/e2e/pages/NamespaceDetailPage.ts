import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { gotoConsolePage } from '../utils/navigation';
import { waitForLoadingComplete } from '../utils/transition';

const isOssmc = (): boolean => process.env.PLAYWRIGHT_OSSMC === 'true';

export class NamespaceDetailPage extends BasePage {
  private targetNamespace = '';

  async open(namespace: string): Promise<void> {
    this.targetNamespace = namespace;
    if (isOssmc()) {
      await this.page.route('**/api/namespaces/graph*', route => route.continue());
    }
    await gotoConsolePage(this.page, `namespaces/${namespace}`);
    if (isOssmc()) {
      await this.page.waitForResponse(response => response.url().includes('/api/namespaces/graph'));
    }
    await waitForLoadingComplete(this.page);
  }

  async openActionsMenu(): Promise<void> {
    await waitForLoadingComplete(this.page);
    await expect(this.page.locator('[role="dialog"]')).toHaveCount(0);
    if (isOssmc()) {
      await this.page.locator('button#minigraph-toggle').click();
    } else {
      await this.getBySel('namespace-actions-toggle').click();
    }
    await expect(this.page.locator('[role="menu"]')).toBeVisible();
  }

  async hasSidecarInjectionAction(action: 'disable' | 'enable' | 'remove'): Promise<boolean> {
    const selector = `${action}-${this.targetNamespace}-namespace-sidecar-injection`;
    return (await this.getBySel(selector).count()) > 0;
  }

  private async clickSidecarInjectionAction(action: 'disable' | 'enable' | 'remove'): Promise<void> {
    await this.openActionsMenu();
    const selector = `${action}-${this.targetNamespace}-namespace-sidecar-injection`;
    const menuItem = this.getBySel(selector);
    if ((await menuItem.count()) === 0) {
      throw new Error(
        `Sidecar injection action "${action}" is not available for namespace ${this.targetNamespace}. ` +
          'Ensure istioInjectionAction is enabled and the cluster is not in istio upgrade mode.'
      );
    }
    await menuItem.click();
    await this.confirmTrafficPolicyModal();
  }

  async confirmTrafficPolicyModal(): Promise<void> {
    const patchPromise = this.page.waitForResponse(
      response => response.request().method() === 'PATCH' && response.url().includes('/api/namespaces/')
    );
    const confirm = this.getBySel('confirm-create');
    await expect(confirm).toBeVisible();
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await patchPromise;
    await expect(this.page.locator('[role="dialog"]')).toHaveCount(0);
    await waitForLoadingComplete(this.page);
  }

  async enableNamespaceInjection(): Promise<void> {
    await this.clickSidecarInjectionAction('enable');
  }

  async disableNamespaceInjection(): Promise<void> {
    await this.clickSidecarInjectionAction('disable');
  }

  async removeNamespaceInjection(): Promise<void> {
    await this.clickSidecarInjectionAction('remove');
  }

  async expectNamespaceInjectionLabel(state: 'absent' | 'disabled' | 'enabled'): Promise<void> {
    const response = await this.page.request.get(`/api/namespaces/${this.targetNamespace}/info`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    if (state === 'enabled') {
      expect(body.labels['istio-injection']).toBe('enabled');
    } else if (state === 'disabled') {
      expect(body.labels['istio-injection']).toBe('disabled');
    } else {
      expect(body.labels).not.toHaveProperty('istio-injection');
    }
  }
}
