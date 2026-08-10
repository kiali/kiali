import { expect } from '@playwright/test';
import { load } from 'js-yaml';
import { BasePage } from './BasePage';
import { gotoConsolePage } from '../utils/navigation';

export class OverviewPage extends BasePage {
  async open(): Promise<void> {
    await gotoConsolePage(this.page, 'overview');
  }

  async openHelpMenu(): Promise<void> {
    await this.robustClick(this.getBySel('about-help-button'));
  }

  async openAbout(): Promise<void> {
    await this.robustClick(this.page.locator('li[role="none"]').filter({ hasText: 'About' }));
  }

  async openHelpAndAbout(): Promise<void> {
    await this.openHelpMenu();
    await this.openAbout();
  }

  async expectHelpMenuOptions(options: string[]): Promise<void> {
    for (const option of options) {
      await expect(this.page.locator('li[role="none"]').filter({ hasText: option })).toBeVisible();
    }
  }

  async openHelpMenuItem(title: string): Promise<void> {
    await this.robustClick(this.page.locator('li[role="none"]').filter({ hasText: title }));
  }

  async expectModalTitle(title: string): Promise<void> {
    await expect(this.page.locator('h1.pf-v6-c-modal-box__title').filter({ hasText: title })).toBeVisible();
  }

  async expectDebugInfoClusterCount(expected: number): Promise<void> {
    const row = this.page
      .locator('tr')
      .filter({ has: this.page.locator('td[data-label="Attribute"]', { hasText: 'clusters' }) });
    const valueCell = row.locator('td[data-label="Value"]');
    await expect(valueCell).toBeVisible();
    const yamlText = (await valueCell.innerText()).trim();
    const parsed = load(yamlText) as Record<string, unknown>;
    expect(Object.keys(parsed).length).toBe(expected);
  }

  async refreshAndExpectNoIstioComponentStatus(): Promise<void> {
    const statusResponse = this.page.waitForResponse(
      response => response.url().includes('/api/istio/status') && response.request().method() === 'GET'
    );
    await this.waitForLoad();
    await this.robustClick(this.getBySel('refresh-button'));
    await statusResponse;
    await expect(this.getBySel('istio-status-danger')).toHaveCount(0);
    await expect(this.getBySel('istio-status-warning')).toHaveCount(0);
  }

  async openUserDropdown(): Promise<void> {
    await this.robustClick(this.getBySel('user-dropdown'));
  }

  async logout(): Promise<void> {
    const logoutResponse = this.page.waitForResponse(response => response.url().includes('/api/logout'));
    await this.robustClick(this.getBySel('user-logout'));
    const response = await logoutResponse;
    expect(response.status()).toBe(204);
  }
}
