import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { gotoListPage } from '../utils/navigation';
import { colExists, expectColumnHeaderVisible, expectColumnHeaderHidden } from '../utils/table';
import { waitForLoadingComplete } from '../utils/transition';

const COLUMN_MANAGEMENT_MODAL = '[data-ouia-component-id="ColumnManagementModal"]';

export type ListPagePath = 'applications' | 'services' | 'workloads';

const listOrderParam: Record<ListPagePath, string> = {
  applications: 'apporder',
  services: 'svcorder',
  workloads: 'wlorder'
};

export class ListPage extends BasePage {
  constructor(
    page: BasePage['page'],
    protected readonly listPath: ListPagePath
  ) {
    super(page);
  }

  async openList(query: Record<string, string> = {}): Promise<void> {
    await gotoListPage(this.page, this.listPath, query);
  }

  async openListWithNamespace(namespace: string, query: Record<string, string> = {}): Promise<void> {
    await this.openList({ namespaces: namespace, ...query });
  }

  async visitWithUrlParams(urlParams: string): Promise<void> {
    const url = new URL(this.page.url());
    const params = new URLSearchParams(url.search);
    for (const part of urlParams.split('&')) {
      const [key, value] = part.split('=');
      if (key && value !== undefined) {
        params.set(key, value);
      }
    }
    params.set('refresh', '0');
    await this.page.goto(`${url.origin}${url.pathname}?${params.toString()}`);
    await this.page.locator('#filter-selection').waitFor({ state: 'visible', timeout: 15_000 });
    await waitForLoadingComplete(this.page);
  }

  async filterBy(filter: string, filterValue: string): Promise<void> {
    await this.page.locator('button#filter_select_type-toggle').click();
    await this.page
      .locator('div#filter_select_type button')
      .filter({ hasText: new RegExp(`^${filter}$`) })
      .click();

    if (filter === 'Istio Name' || filter === 'App Name') {
      await this.page.locator('input#filter_input_value').fill(filterValue);
      await this.page.locator('input#filter_input_value').press('Enter');
    } else if (filter === 'Istio Config Type') {
      const input = this.page.locator('input[placeholder="Filter by Istio Config Type"]');
      await input.fill(filterValue);
      await input.press('Enter');
      await this.page.locator(`li[label="${filterValue}"] button`).click();
    } else if (filter === 'Istio Sidecar' || filter === 'Health') {
      await this.page.locator('button#filter_select_value-toggle').click();
      await this.page
        .locator('div#filter_select_value')
        .getByRole('option', { name: filterValue, exact: true })
        .click();
    } else if (filter === 'Label') {
      await this.page.locator('input#filter_input_label').fill(filterValue);
      await this.page.locator('input#filter_input_label').press('Enter');
    }

    await waitForLoadingComplete(this.page);
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

  async openColumnManagement(testId: string): Promise<void> {
    await expect(this.page.locator('#filter-selection')).toBeVisible();
    await this.getBySel(testId).click();
    await expect(this.page.locator(COLUMN_MANAGEMENT_MODAL)).toBeVisible();
  }

  async expectColumnManagementModal(): Promise<void> {
    await expect(this.page.locator(COLUMN_MANAGEMENT_MODAL)).toBeVisible();
    await expect(this.page.locator(COLUMN_MANAGEMENT_MODAL).locator('h1')).toContainText('Manage columns');
  }

  async expectModalTitle(title: string): Promise<void> {
    await expect(this.page.locator(COLUMN_MANAGEMENT_MODAL).locator('h1')).toContainText(title);
  }

  private columnCheckbox(columnName: string) {
    const columnKey = columnName.toLowerCase();
    return this.page.locator(COLUMN_MANAGEMENT_MODAL).locator(`[data-testid="column-check-${columnKey}"]`);
  }

  async expectColumnCheckboxDisabled(columnName: string): Promise<void> {
    await expect(this.columnCheckbox(columnName)).toBeDisabled();
  }

  async expectColumnCheckboxChecked(columnName: string): Promise<void> {
    await expect(this.columnCheckbox(columnName)).toBeChecked();
  }

  async setColumnChecked(columnName: string, checked: boolean): Promise<void> {
    const checkbox = this.columnCheckbox(columnName);
    const isChecked = await checkbox.isChecked();
    const isDisabled = await checkbox.isDisabled();
    if (isDisabled) {
      return;
    }
    if (checked && !isChecked) {
      await checkbox.click();
    } else if (!checked && isChecked) {
      await checkbox.click();
    }
  }

  async applyColumnChanges(): Promise<void> {
    await this.page.locator('[data-ouia-component-id="ColumnManagementModal-save-button"]').click();
    await expect(this.page.locator(COLUMN_MANAGEMENT_MODAL)).toHaveCount(0);
  }

  async closeColumnManagementModal(): Promise<void> {
    await this.page.locator(`${COLUMN_MANAGEMENT_MODAL} button[aria-label="Close"]`).click();
    await expect(this.page.locator(COLUMN_MANAGEMENT_MODAL)).toHaveCount(0);
  }

  async resetColumnsToDefault(): Promise<void> {
    await this.page.locator('[data-ouia-component-id="ColumnManagementModal-reset-button"]').click();
    await this.page.locator('[data-ouia-component-id="ColumnManagementModal-save-button"]').click();
    await expect(this.page.locator(COLUMN_MANAGEMENT_MODAL)).toHaveCount(0);
  }

  async expectColumnVisibleInTable(columnName: string): Promise<void> {
    await expectColumnHeaderVisible(this.page, columnName);
  }

  async expectColumnHiddenInTable(columnName: string): Promise<void> {
    await expectColumnHeaderHidden(this.page, columnName);
  }

  async reorderColumnsViaUrl(): Promise<void> {
    await this.closeColumnManagementModal();
    const url = new URL(this.page.url());
    url.searchParams.set(listOrderParam[this.listPath], 'health,name,namespace');
    url.searchParams.set('refresh', '0');
    await this.page.goto(url.toString());
    await this.page.locator('#filter-selection').waitFor({ state: 'visible', timeout: 15_000 });
    await waitForLoadingComplete(this.page);
  }

  async expectFirstDataColumn(label: string): Promise<void> {
    await expect(this.page.locator('table thead th[data-label]').first()).toHaveAttribute('data-label', label);
  }

  async expectDefaultAppsColumns(): Promise<void> {
    const defaultColumns = ['Name', 'Health', 'Namespace', 'Labels', 'Details'];
    for (const column of defaultColumns) {
      await expectColumnHeaderVisible(this.page, column);
    }
  }

  async expectUrlContains(text: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(text));
  }

  async refreshPage(): Promise<void> {
    await this.page.reload();
    await waitForLoadingComplete(this.page);
  }
}
