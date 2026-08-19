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
    if (await this.sidebar.isHidden()) {
      await this.navToggle.click();
    }
    await expect(this.sidebar).toBeVisible();
  }

  async ensureSidebarClosed(): Promise<void> {
    await this.waitForLoad();
    if (await this.sidebar.isVisible()) {
      await this.navToggle.click();
    }
    await expect(this.sidebar).not.toBeVisible();
  }

  async toggleNavigation(): Promise<void> {
    await this.navToggle.click();
  }

  async expectSidebarVisible(): Promise<void> {
    await expect(this.sidebar).toBeVisible();
  }

  async expectSidebarHidden(): Promise<void> {
    await expect(this.sidebar).not.toBeVisible();
  }
}
