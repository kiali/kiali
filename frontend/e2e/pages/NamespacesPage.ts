import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { gotoConsolePage } from '../utils/navigation';
import { linkSelector } from '../utils/linkSelector';
import {
  colExists,
  expectColumnNotEmptyOnRow,
  expectColumnTextOnRow,
  expectHealthIconInRow,
  expectListSortedByColumn,
  expectMtlsTooltipOnRow,
  expectRowCount,
  expectTableColumnOrder,
  expectTableHeadings,
  sortListByColumn
} from '../utils/table';
import { waitForLoadingComplete } from '../utils/transition';

const COLUMN_MANAGEMENT_MODAL = '[data-ouia-component-id="ColumnManagementModal"]';

const columnTitleToId = (title: string): string => {
  const map: Record<string, string> = {
    'Istio config': 'istioconfiguration'
  };
  return map[title] ?? title.toLowerCase();
};

const isOssmc = (): boolean => process.env.PLAYWRIGHT_OSSMC === 'true';

export class NamespacesPage extends BasePage {
  async openList(query: Record<string, string> = {}): Promise<void> {
    await gotoConsolePage(this.page, 'namespaces', query);
    await this.page.locator('#filter-selection').waitFor({ state: 'visible', timeout: 15_000 });
  }

  async expectNamespaceVisible(namespace: string): Promise<void> {
    await expect(this.page.locator('tbody td[data-label="Namespace"]').filter({ hasText: namespace })).toBeVisible();
  }

  async clickNamespaceDetailLink(namespace: string): Promise<void> {
    await this.page
      .locator('tbody')
      .locator('td[data-label="Namespace"]')
      .filter({ hasText: namespace })
      .locator(linkSelector())
      .filter({ hasText: namespace })
      .first()
      .click();
  }

  async expectOnNamespaceDetailPage(namespace: string): Promise<void> {
    const urlSegment = isOssmc() ? `/projects/${namespace}` : `/namespaces/${namespace}`;
    await expect(this.page).toHaveURL(new RegExp(urlSegment));
    await expect(this.getBySel(`namespace-detail-overview-${namespace}`)).toBeVisible();
  }

  async expectTableHeadings(headings: string[]): Promise<void> {
    await expectTableHeadings(this.page, headings);
  }

  async expectColumn(colName: string, visible: boolean): Promise<void> {
    await colExists(this.page, colName, visible);
  }

  async expectBookinfoNamespaceTableInfo(): Promise<void> {
    await this.expectNamespaceVisible('bookinfo');
    await this.expectTableHeadings(['Namespace', 'Type', 'Health', 'mTLS', 'Istio config', 'Labels']);
    await expectColumnTextOnRow(this.page, 'bookinfo', 'Namespace', 'bookinfo');
    await expectColumnNotEmptyOnRow(this.page, 'bookinfo', 'Type');
    await expectHealthIconInRow(this.page, 'bookinfo');
    await expectColumnTextOnRow(this.page, 'bookinfo', 'mTLS', 'Permissive');
    await expectMtlsTooltipOnRow(this.page, 'bookinfo', 'Inheriting');
    await expectColumnNotEmptyOnRow(this.page, 'bookinfo', 'Istio config');
    await expectColumnNotEmptyOnRow(this.page, 'bookinfo', 'Labels');
  }

  async filterBy(filter: string, filterValue: string): Promise<void> {
    await this.page.locator('button#filter_select_type-toggle').click();
    await this.page
      .locator('div#filter_select_type button')
      .filter({ hasText: new RegExp(`^${filter}$`) })
      .click();

    if (filter === 'Namespace') {
      await this.page.locator('input#filter_input_value').fill(filterValue);
      await this.page.locator('input#filter_input_value').press('Enter');
    } else if (filter === 'Type') {
      const valueToggle = this.page
        .locator('button#filter_select_value-toggle, div#filter_select_value-toggle button')
        .first();
      await valueToggle.click();
      await this.page
        .locator('div#filter_select_value')
        .getByRole('option', { name: filterValue, exact: true })
        .click();
    }

    await waitForLoadingComplete(this.page);
  }

  async sortByColumn(column: string, order: 'ascending' | 'descending'): Promise<void> {
    await sortListByColumn(this.page, column, order);
  }

  async expectSortedByColumn(column: string, order: 'ascending' | 'descending'): Promise<void> {
    await expectListSortedByColumn(this.page, column, order);
  }

  async expectRowCount(count: number): Promise<void> {
    await expectRowCount(this.page, count);
  }

  async openColumnManagement(): Promise<void> {
    await expect(this.page.locator('#filter-selection')).toBeVisible();
    await this.getBySel('namespaces-manage-columns').click();
    await expect(this.page.locator(COLUMN_MANAGEMENT_MODAL)).toBeVisible();
  }

  private columnCheckbox(columnName: string) {
    const columnKey = columnTitleToId(columnName);
    return this.page.locator(COLUMN_MANAGEMENT_MODAL).locator(`[data-testid="column-check-${columnKey}"]`);
  }

  async setColumnChecked(columnName: string, checked: boolean): Promise<void> {
    const checkbox = this.columnCheckbox(columnName);
    const isChecked = await checkbox.isChecked();
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

  async resetColumnsToDefault(): Promise<void> {
    await this.openColumnManagement();
    await this.page.locator('[data-ouia-component-id="ColumnManagementModal-reset-button"]').click();
    await this.applyColumnChanges();
  }

  async setColumnOrderViaUrl(columnTitles: string[]): Promise<void> {
    const orderParam = columnTitles.map(columnTitleToId).join(',');
    await gotoConsolePage(this.page, 'namespaces', { nsorder: orderParam });
    await this.page.locator('#filter-selection').waitFor({ state: 'visible', timeout: 15_000 });
  }

  async expectColumnOrder(columnTitles: string[]): Promise<void> {
    await expect(this.page.locator(COLUMN_MANAGEMENT_MODAL)).toHaveCount(0);
    await expectTableColumnOrder(this.page, columnTitles);
  }
}
