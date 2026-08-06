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
}
