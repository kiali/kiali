import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

const LEGACY_APPEARANCE_KEYS = ['KIALI_COLOR_SCHEME', 'KIALI_CONTRAST_MODE', 'KIALI_THEME'];

/**
 * Masthead appearance preferences (user dropdown -> Preferences): color scheme, contrast
 * mode, and theme variant. Selections apply immediately as classes on <html> and persist
 * in redux-persist's globalState, so tests must reset to defaults before asserting.
 */
export class AppearancePage extends BasePage {
  /** Clears persisted appearance preferences and resets to light/default/default. */
  async resetToDefaults(): Promise<void> {
    await this.page.evaluate(
      keys => keys.forEach(key => window.localStorage.removeItem(key)),
      LEGACY_APPEARANCE_KEYS
    );

    await this.openPreferences();
    const html = this.page.locator('html');
    if (await html.evaluate(el => el.classList.contains('pf-v6-theme-dark'))) {
      await this.selectPreferenceOption('color-scheme-select', 'Light');
    }
    if (await html.evaluate(el => el.classList.contains('pf-v6-theme-felt'))) {
      await this.selectPreferenceOption('theme-select', 'Default');
    }
    if (
      await html.evaluate(
        el => el.classList.contains('pf-v6-theme-glass') || el.classList.contains('pf-v6-theme-high-contrast')
      )
    ) {
      await this.selectPreferenceOption('contrast-mode-select', 'Default');
    }
    await this.closePreferences();

    await expect(html).not.toHaveClass(/pf-v6-theme-dark|pf-v6-theme-glass|pf-v6-theme-high-contrast/);
    await expect(html).not.toHaveClass(/pf-v6-theme-felt/);
  }

  async selectColorScheme(colorScheme: 'Dark' | 'Light'): Promise<void> {
    await this.openPreferences();
    await this.selectPreferenceOption('color-scheme-select', colorScheme);
    await this.closePreferences();
  }

  async selectContrastMode(contrastMode: 'Default' | 'Glass' | 'High contrast'): Promise<void> {
    await this.openPreferences();
    await this.selectPreferenceOption('contrast-mode-select', contrastMode);
    await this.closePreferences();
  }

  async selectTheme(theme: 'Default' | 'Project Felt'): Promise<void> {
    await this.openPreferences();
    await this.selectPreferenceOption('theme-select', theme);
    await this.closePreferences();
  }

  private async openPreferences(): Promise<void> {
    await this.page.locator('[data-test="user-dropdown"]').getByRole('button').click();
    await this.getBySel('preferences').click();
    await expect(this.getBySel('preferences-modal')).toBeVisible();
  }

  private async closePreferences(): Promise<void> {
    await this.getBySel('preferences-close').click();
    await expect(this.getBySel('preferences-modal')).toHaveCount(0);
  }

  // Options carry a description, so match on the label fragment rather than the full accessible name.
  private async selectPreferenceOption(selectDataTest: string, optionLabel: string): Promise<void> {
    await this.getBySel(selectDataTest).click();
    await this.page.getByRole('option', { name: optionLabel }).click();
  }
}
