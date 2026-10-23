import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';

const USER_DROPDOWN = '[data-test="user-dropdown"]';
const PREFERENCES_MODAL = '[data-test="preferences-modal"]';

const openPreferences = (): void => {
  cy.get('body').then($body => {
    if ($body.find(PREFERENCES_MODAL).length > 0) {
      cy.getBySel('preferences-modal').should('be.visible');
      return;
    }

    ensureKialiFinishedLoading();
    cy.get(USER_DROPDOWN).should('be.visible').click();
    cy.getBySel('preferences').click();
    cy.getBySel('preferences-modal').should('be.visible');
  });
};

const selectPreferenceOption = (selectId: string, optionLabel: string): void => {
  cy.getBySel(selectId).click();
  cy.contains('[role="option"]', optionLabel).click();
};

const resetAppearanceToDefaults = (): void => {
  openPreferences();
  cy.get('html').then($html => {
    if ($html.hasClass('pf-v6-theme-dark')) {
      selectPreferenceOption('color-scheme-select', 'Light');
    }
    if ($html.hasClass('pf-v6-theme-felt')) {
      selectPreferenceOption('theme-select', 'Default');
    }
    if ($html.hasClass('pf-v6-theme-glass') || $html.hasClass('pf-v6-theme-high-contrast')) {
      selectPreferenceOption('contrast-mode-select', 'Default');
    }
  });
  cy.getBySel('preferences-close').click();
  cy.get(PREFERENCES_MODAL).should('not.exist');
};

/**
 * Resets appearance to defaults (light color scheme, default contrast, default theme).
 * Clears persisted appearance preferences so prior runs do not leak state.
 */
Given('the color scheme is explicitly set to light', () => {
  cy.get(USER_DROPDOWN).should('be.visible');
  cy.window().then(win => {
    win.localStorage.removeItem('KIALI_COLOR_SCHEME');
    win.localStorage.removeItem('KIALI_CONTRAST_MODE');
    win.localStorage.removeItem('KIALI_THEME');
  });
  resetAppearanceToDefaults();
  cy.get('html').should('not.have.class', 'pf-v6-theme-dark');
  cy.get('html').should('not.have.class', 'pf-v6-theme-glass');
  cy.get('html').should('not.have.class', 'pf-v6-theme-high-contrast');
  cy.get('html').should('not.have.class', 'pf-v6-theme-felt');
});

When('the user switches to dark color scheme', () => {
  openPreferences();
  selectPreferenceOption('color-scheme-select', 'Dark');
  cy.get('html').should('have.class', 'pf-v6-theme-dark');
});

When('the user switches to light color scheme', () => {
  openPreferences();
  selectPreferenceOption('color-scheme-select', 'Light');
  cy.get('html').should('not.have.class', 'pf-v6-theme-dark');
});

When('the user selects glass contrast mode', () => {
  openPreferences();
  selectPreferenceOption('contrast-mode-select', 'Glass');
});

When('the user selects high contrast mode', () => {
  openPreferences();
  selectPreferenceOption('contrast-mode-select', 'High contrast');
});

When('the user selects default contrast mode', () => {
  openPreferences();
  selectPreferenceOption('contrast-mode-select', 'Default');
});

When('the user selects project felt theme', () => {
  openPreferences();
  selectPreferenceOption('theme-select', 'Project Felt');
});

When('the user selects default theme', () => {
  openPreferences();
  selectPreferenceOption('theme-select', 'Default');
});

Then('the document should use light color scheme', () => {
  cy.get('html').should('not.have.class', 'pf-v6-theme-dark');
});

Then('the document should use dark color scheme', () => {
  cy.get('html').should('have.class', 'pf-v6-theme-dark');
});

Then('the document should use glass contrast mode', () => {
  cy.get('html').should('have.class', 'pf-v6-theme-glass');
  cy.get('html').should('not.have.class', 'pf-v6-theme-high-contrast');
});

Then('the document should use high contrast mode', () => {
  cy.get('html').should('have.class', 'pf-v6-theme-high-contrast');
  cy.get('html').should('not.have.class', 'pf-v6-theme-glass');
});

Then('the document should use default contrast mode', () => {
  cy.get('html').should('not.have.class', 'pf-v6-theme-glass');
  cy.get('html').should('not.have.class', 'pf-v6-theme-high-contrast');
});

Then('the document should use default theme', () => {
  cy.get('html').should('not.have.class', 'pf-v6-theme-felt');
});

Then('the document should use project felt theme', () => {
  cy.get('html').should('have.class', 'pf-v6-theme-felt');
});
