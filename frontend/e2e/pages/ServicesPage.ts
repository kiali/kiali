import { expect } from '@playwright/test';
import { ListPage } from './ListPage';

export class ServicesPage extends ListPage {
  constructor(page: ListPage['page']) {
    super(page, 'services');
  }

  async expectAllTogglesChecked(): Promise<void> {
    await expect(this.getBySel('toggle-configuration')).toBeChecked();
    await expect(this.getBySel('toggle-health')).toBeChecked();
    await expect(this.getBySel('toggle-istioResources')).toBeChecked();
    await this.expectColumn('Configuration', true);
    await this.expectColumn('Health', true);
    await this.expectColumn('Details', true);
  }
}
