import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { chooseFromSelect } from '../utils/pfSelect';
import { waitForLoadingComplete } from '../utils/transition';

export class IstioConfigWizardPage extends BasePage {
  async expectConfigWizard(title: string): Promise<void> {
    await expect(this.page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
  }

  async addListener(): Promise<void> {
    await this.page.locator('button[name="addListener"]').click();
  }

  async addHostname(): Promise<void> {
    await this.page.locator('button[name="addAddress"]').click();
  }

  async typesInInput(id: string, value: string): Promise<void> {
    await this.page.locator(`input[id="${id}"]`).fill(value);
  }

  async checkHostnameValidation(id: string): Promise<void> {
    const invalidValues = ['host', '1.1.1.1', 'namespace/host', '*.hostname.*.com', '*', 'HOST.com'];
    for (const value of invalidValues) {
      await this.page.locator(`input[id="${id}"]`).fill(value);
      await expect(this.page.locator(`input[id="${id}"]`)).toHaveAttribute('aria-invalid', 'true');
    }
    await this.page.locator(`input[id="${id}"]`).fill('*.hostname.com');
    await expect(this.page.locator(`input[id="${id}"]`)).toHaveAttribute('aria-invalid', 'false');
  }

  async addServerToServerList(): Promise<void> {
    await this.page.locator('button[name="addServer"]').click();
  }

  async expectInputWarning(id: string, hasWarning: boolean): Promise<void> {
    await expect(this.page.locator(`input[id="${id}"]`)).toHaveAttribute('aria-invalid', hasWarning ? 'true' : 'false');
  }

  async clickCreate(): Promise<void> {
    const create = this.getBySel('create');
    await expect(create).toBeVisible();
    await expect(create).toBeEnabled();
    await create.click();
  }

  async createIstioConfig(): Promise<void> {
    await this.clickCreate();
    await expect(this.page).not.toHaveURL(/\/istio\/new\//, { timeout: 60_000 });
    await waitForLoadingComplete(this.page);
  }

  async previewConfiguration(): Promise<void> {
    const preview = this.getBySel('preview');
    await expect(preview).toBeEnabled();
    await preview.click();
    await expect(this.getBySel('create')).toBeVisible();
  }

  async chooseModeFromSelect(option: string, id: string): Promise<void> {
    await chooseFromSelect(this.page, option, id);
  }

  async expectMessage(message: string): Promise<void> {
    await expect(this.page.locator('main')).toContainText(message);
  }

  async openSubmenu(title: string): Promise<void> {
    await this.page.getByRole('button', { name: title }).click();
  }

  async expectPreviewButtonDisabled(): Promise<void> {
    await expect(this.getBySel('preview')).toBeDisabled();
  }

  async expectErrorMessage(message: string): Promise<void> {
    await expect(this.page.locator('h4')).toContainText(message);
  }

  async expectInputEmpty(id: string): Promise<void> {
    await expect(this.page.locator(`input[id="${id}"]`)).toBeEmpty();
  }

  async selectClusters(clusters: string): Promise<void> {
    await this.getBySel('cluster-dropdown').click();
    for (const cluster of clusters.split(',')) {
      await this.page.locator(`input[type="checkbox"][value="${cluster.trim()}"]`).check();
    }
    await this.getBySel('cluster-dropdown').click();
  }

  async closeSuccessNotification(): Promise<void> {
    await this.page
      .locator('[aria-label^="Close Success alert: alert: Istio networking.istio.io/v1, Kind=Gateway created"]')
      .click();
  }

  async expectNoClusterDropdown(): Promise<void> {
    await expect(this.getBySel('cluster-dropdown')).toHaveCount(0);
  }

  async editLabels(key: string, value: string): Promise<void> {
    await this.getBySel('edit-labels').click();
    await this.page.locator('input[id="labelInputForKey_0"]').fill(key);
    await this.page.locator('input[id="labelInputForValue_0"]').fill(value);
    await this.getBySel('save-button').click();
  }

  async editAnnotations(key: string, value: string): Promise<void> {
    await this.getBySel('edit-annotations').click();
    await this.page.locator('input[id="labelInputForKey_0"]').fill(key);
    await this.page.locator('input[id="labelInputForValue_0"]').fill(value);
    await this.getBySel('save-button').click();
  }

  async expectPreviewContains(value: string): Promise<void> {
    await expect(this.page.locator('[data-test="editor-preview"] .monaco-editor')).toBeVisible();
    await expect
      .poll(async () => {
        return this.page.evaluate(expected => {
          const win = window as Window & {
            monaco?: { editor: { getEditors: () => Array<{ getValue: () => string }> } };
          };
          const monaco = win.monaco;
          if (!monaco) {
            return false;
          }
          return monaco.editor.getEditors().some(ed => ed.getValue().includes(expected));
        }, value);
      })
      .toBe(true);
  }
}
