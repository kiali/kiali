import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { waitForLoadingComplete } from '../utils/transition';

export class IstioConfigWizardPage extends BasePage {
  async expectConfigWizard(title: string): Promise<void> {
    await expect(this.page.locator('h1')).toContainText(title);
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

  async createIstioConfig(): Promise<void> {
    const create = this.getBySel('create');
    await expect(create).toBeVisible();
    await expect(create).toBeEnabled();
    await create.click();
    await expect(this.page).not.toHaveURL(/\/istio\/new\//);
    await waitForLoadingComplete(this.page);
  }

  async previewConfiguration(): Promise<void> {
    const preview = this.getBySel('preview');
    await expect(preview).toBeEnabled();
    await preview.click();
    await expect(this.getBySel('create')).toBeVisible();
  }

  async chooseModeFromSelect(option: string, id: string): Promise<void> {
    const select = this.page.locator(`select[id="${id}"]`);
    if ((await select.count()) > 0) {
      await select.selectOption(option);
      return;
    }
    await this.page.locator(`button[id="${id}-toggle"]`).click();
    const menu = this.page.locator(`#${id}-menu, [aria-label="${id} Select"]`).first();
    const optionLocator = menu.getByRole('option', { name: new RegExp(option, 'i') });
    if ((await optionLocator.count()) > 0) {
      await optionLocator.first().click();
      return;
    }
    await this.page
      .locator('.pf-v6-c-menu__list-item')
      .filter({ hasText: new RegExp(option, 'i') })
      .first()
      .click();
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
