import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { gotoConsolePage } from '../utils/navigation';
import { waitForLoadingComplete } from '../utils/transition';

export class AppDetailsPage extends BasePage {
  async openApp(namespace: string, name: string): Promise<void> {
    await gotoConsolePage(this.page, `namespaces/${namespace}/applications/${name}?refresh=0`);
    await waitForLoadingComplete(this.page);
  }

  async expectMinigraphVisible(): Promise<void> {
    const card = this.page.locator('#MiniGraphCard');
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading', { name: 'Empty Graph' })).toHaveCount(0);
  }

  async expectUrlIncludes(text: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(text));
  }

  async expectUrlExcludes(text: string): Promise<void> {
    await expect(this.page).not.toHaveURL(new RegExp(text));
  }
}
