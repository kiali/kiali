import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { waitForLoadingComplete } from '../utils/transition';

export class K8sRoutingWizardPage extends BasePage {
  async expectWizard(title: string): Promise<void> {
    await expect(this.page.locator(`div[aria-label="${title}"]`)).toBeVisible();
  }

  async clickTab(tab: string): Promise<void> {
    await this.getBySel(tab).click();
  }

  async clickRequestMatchingDropdown(select: string): Promise<void> {
    await this.getBySel('requestmatching-header-toggle').click();
    await this.page.locator(`li[data-test="requestmatching-header-${select}"]`).locator('button').click();
  }

  async clickRequestFilteringDropdown(select: string): Promise<void> {
    await this.getBySel('filtering-type-toggle').click();
    await this.page.locator(`li[data-test="filtering-type-${select}"]`).locator('button').click();
  }

  async typeMatchingHeader(header: string): Promise<void> {
    await this.page.locator('input#header-name-id').fill(header);
  }

  async typeFilteringHeader(header: string): Promise<void> {
    await this.page.locator('input#filter-header-name-id').fill(header);
  }

  async clickMatchValueDropdown(value: string): Promise<void> {
    await this.getBySel('requestmatching-match-toggle').click();
    await this.page.locator(`li[data-test="requestmatching-match-${value}"]`).locator('button').click();
  }

  async typeMatchValue(value: string): Promise<void> {
    await this.page.locator('input#match-value-id').fill(value);
  }

  async addMatch(): Promise<void> {
    await this.getBySel('add-match').click();
  }

  async addFilter(): Promise<void> {
    await this.getBySel('add-filter').click();
  }

  async typeTrafficWeight(weight: string, workload: string): Promise<void> {
    await this.getBySel(`input-slider-${workload}`).fill(weight);
  }

  async addRoute(): Promise<void> {
    await this.getBySel('add-route').click();
  }

  async clickMatchingSelected(match: string): Promise<void> {
    await this.getBySel(match).locator('button').first().click();
  }

  async previewConfiguration(): Promise<void> {
    const preview = this.getBySel('preview');
    await expect(preview).toBeEnabled();
    await preview.click();
    await expect(this.getBySel('create').or(this.getBySel('update'))).toBeVisible();
  }

  async createConfiguration(): Promise<void> {
    const create = this.getBySel('create');
    await expect(create).toBeEnabled();
    await create.click();
    await this.getBySel('confirm-create').click();
    await waitForLoadingComplete(this.page);
  }

  async updateConfiguration(): Promise<void> {
    const update = this.getBySel('update');
    await expect(update).toBeEnabled();
    const responses = this.page.waitForResponse(
      response =>
        response.request().method() !== 'GET' &&
        response.url().includes('/api/') &&
        response.url().includes('/istio/') &&
        response.ok(),
      { timeout: 60_000 }
    );
    await update.click();
    await expect(this.getBySel('confirm-update')).toBeVisible();
    const confirm = this.getBySel('confirm-update');
    await confirm.click();
    await responses;
    await expect(this.page.getByRole('dialog')).toHaveCount(0);
    await waitForLoadingComplete(this.page);
  }

  async confirmDeleteConfiguration(): Promise<void> {
    await this.getBySel('confirm-delete').click();
    await waitForLoadingComplete(this.page);
  }

  async clickAdvancedOptions(): Promise<void> {
    await this.page.getByRole('button', { name: 'Show advanced options' }).click();
  }

  async clickAddGateway(): Promise<void> {
    const gatewaySwitch = this.page.locator('input#advanced-gwSwitch');
    if (!(await gatewaySwitch.isChecked())) {
      await this.page.locator('input#advanced-gwSwitch + *').click();
    }
    await expect(gatewaySwitch).toBeChecked();
  }

  async selectCreateGateway(): Promise<void> {
    await this.page.getByRole('radio', { name: /Create K8s API Gateway/i }).click();
    await expect(this.page.locator('#createGateway')).toBeChecked();
  }

  async expectReference(namespace: string, name: string, type: string): Promise<void> {
    await expect(this.getBySel(`${type}-${namespace}-${name}`)).toBeVisible();
  }

  async clickReference(namespace: string, name: string, type: string): Promise<void> {
    await this.getBySel(`${type}-${namespace}-${name}`).click();
    const pathByType: Record<string, string> = {
      destinationrule: `/namespaces/${namespace}/istio/networking.istio.io/v1/DestinationRule/${name}`,
      service: `/namespaces/${namespace}/services/${name}`,
      virtualservice: `/namespaces/${namespace}/istio/networking.istio.io/v1/VirtualService/${name}`
    };
    await expect(this.page).toHaveURL(new RegExp(pathByType[type]));
  }
}
