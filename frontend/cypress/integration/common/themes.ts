import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';

const THEME_DROPDOWN = '[data-test="theme-dropdown"]';
const COLOR_SCHEME_TOGGLE = '[data-test="color-scheme-toggle"]';
const CONTRAST_MODE_TOGGLE = '[data-test="contrast-mode-toggle"]';
const THEME_TOGGLE = '[data-test="theme-toggle"]';

const COLOR_SCHEME_DARK = '#color-scheme-dark';
const COLOR_SCHEME_LIGHT = '#color-scheme-light';
const CONTRAST_MODE_DEFAULT = '#contrast-mode-default';
const CONTRAST_MODE_GLASS = '#contrast-mode-glass';
const CONTRAST_MODE_HIGH_CONTRAST = '#contrast-mode-high-contrast';
const THEME_DEFAULT = '#theme-default';
const THEME_FELT = '#theme-felt';

const openAppearanceMenu = (): void => {
  cy.get(THEME_DROPDOWN).then($toggle => {
    if ($toggle.attr('aria-expanded') !== 'true') {
      cy.wrap($toggle).click();
    }
  });
};

const resetAppearanceToDefaults = (): void => {
  openAppearanceMenu();
  cy.get('html').then($html => {
    if ($html.hasClass('pf-v6-theme-dark')) {
      cy.get(COLOR_SCHEME_TOGGLE).find(COLOR_SCHEME_LIGHT).click();
    }
    if ($html.hasClass('pf-v6-theme-felt')) {
      cy.get(THEME_TOGGLE).find(THEME_DEFAULT).click();
    }
    if ($html.hasClass('pf-v6-theme-glass') || $html.hasClass('pf-v6-theme-high-contrast')) {
      cy.get(CONTRAST_MODE_TOGGLE).find(CONTRAST_MODE_DEFAULT).click();
    }
  });
};

/**
 * Resets appearance to defaults (light color scheme, default contrast, default theme).
 * Clears persisted appearance preferences so prior runs do not leak state.
 */
Given('the color scheme is explicitly set to light', () => {
  cy.get(THEME_DROPDOWN).should('be.visible');
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
  openAppearanceMenu();
  cy.get(COLOR_SCHEME_TOGGLE).find(COLOR_SCHEME_DARK).click();
  cy.get('html').should('have.class', 'pf-v6-theme-dark');
});

When('the user switches to light color scheme', () => {
  openAppearanceMenu();
  cy.get(COLOR_SCHEME_TOGGLE).find(COLOR_SCHEME_LIGHT).click();
  cy.get('html').should('not.have.class', 'pf-v6-theme-dark');
});

When('the user selects glass contrast mode', () => {
  openAppearanceMenu();
  cy.get(CONTRAST_MODE_TOGGLE).find(CONTRAST_MODE_GLASS).click();
});

When('the user selects high contrast mode', () => {
  openAppearanceMenu();
  cy.get(CONTRAST_MODE_TOGGLE).find(CONTRAST_MODE_HIGH_CONTRAST).click();
});

When('the user selects default contrast mode', () => {
  openAppearanceMenu();
  cy.get(CONTRAST_MODE_TOGGLE).find(CONTRAST_MODE_DEFAULT).click();
});

When('the user selects project felt theme', () => {
  openAppearanceMenu();
  cy.get(THEME_TOGGLE).find(THEME_FELT).click();
});

When('the user selects default theme', () => {
  openAppearanceMenu();
  cy.get(THEME_TOGGLE).find(THEME_DEFAULT).click();
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
