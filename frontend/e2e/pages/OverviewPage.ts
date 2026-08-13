import { expect } from '@playwright/test';
import { load } from 'js-yaml';
import { BasePage } from './BasePage';
import { gotoConsolePage } from '../utils/navigation';

export class OverviewPage extends BasePage {
  async open(): Promise<void> {
    await gotoConsolePage(this.page, 'overview');
  }

  async openHelpMenu(): Promise<void> {
    await this.getBySel('about-help-button').click();
  }

  async openAbout(): Promise<void> {
    await this.page.getByRole('menuitem', { name: 'About' }).click();
  }

  async openHelpAndAbout(): Promise<void> {
    await this.openHelpMenu();
    await this.openAbout();
  }

  async expectHelpMenuOptions(options: string[]): Promise<void> {
    for (const option of options) {
      await expect(this.page.getByRole('menuitem', { name: option })).toBeVisible();
    }
  }

  async openHelpMenuItem(title: string): Promise<void> {
    await this.page.getByRole('menuitem', { name: title }).click();
  }

  async expectModalTitle(title: string): Promise<void> {
    await expect(this.page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
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
    await this.getBySel('refresh-button').click();
    await statusResponse;
    await expect(this.getBySel('istio-status-danger')).toHaveCount(0);
    await expect(this.getBySel('istio-status-warning')).toHaveCount(0);
  }

  async openUserDropdown(): Promise<void> {
    await this.getBySel('user-dropdown').click();
  }

  async logout(): Promise<void> {
    const logoutResponse = this.page.waitForResponse(response => response.url().includes('/api/logout'));
    await this.getBySel('user-logout').click();
    const response = await logoutResponse;
    expect(response.status()).toBe(204);
  }
}
