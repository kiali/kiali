import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { gotoListPage } from '../utils/navigation';
import { colExists } from '../utils/table';

export class ServicesPage extends BasePage {
  async openList(): Promise<void> {
    await gotoListPage(this.page, 'services');
  }

  async expectAllTogglesChecked(): Promise<void> {
    await expect(this.getBySel('toggle-configuration')).toBeChecked();
    await expect(this.getBySel('toggle-health')).toBeChecked();
    await expect(this.getBySel('toggle-istioResources')).toBeChecked();
    await colExists(this.page, 'Configuration', true);
    await colExists(this.page, 'Health', true);
    await colExists(this.page, 'Details', true);
  }

  async setToggle(toggle: string, checked: boolean): Promise<void> {
    const locator = this.getBySel(`toggle-${toggle}`);
    if (checked) {
      await locator.check();
    } else {
      await locator.uncheck();
    }
  }

  async expectColumn(colName: string, visible: boolean): Promise<void> {
    await colExists(this.page, colName, visible);
  }
}
