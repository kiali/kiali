import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { gotoConsolePage } from '../utils/navigation';

export class SidebarPage extends BasePage {
  private readonly sidebar = this.page.locator('#page-sidebar');
  private readonly navToggle = this.page.locator('#nav-toggle');

  async openOverview(): Promise<void> {
    await gotoConsolePage(this.page, 'overview');
  }

  async ensureSidebarOpen(): Promise<void> {
    await this.waitForLoad();
    await expect(this.sidebar).toBeVisible();
    const hidden = await this.sidebar.getAttribute('aria-hidden');
    if (hidden === 'true') {
      await this.robustClick(this.navToggle);
    }
    await expect(this.sidebar).toBeVisible();
  }

  async ensureSidebarClosed(): Promise<void> {
    await this.waitForLoad();
    await expect(this.sidebar).toBeAttached();
    const hidden = await this.sidebar.getAttribute('aria-hidden');
    if (hidden === 'false') {
      await this.robustClick(this.navToggle);
    }
    await expect(this.sidebar).not.toBeVisible();
  }

  async toggleNavigation(): Promise<void> {
    await this.robustClick(this.navToggle);
  }

  async expectSidebarVisible(): Promise<void> {
    await expect(this.sidebar).toBeVisible();
  }

  async expectSidebarHidden(): Promise<void> {
    await expect(this.sidebar).not.toBeVisible();
  }
}
