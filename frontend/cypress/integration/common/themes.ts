import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';

const THEME_SWITCH = '[data-test="theme-switch"]';
const COLOR_SCHEME_SWITCH = '[data-test="theme-color-scheme-switch"]';
const CONTRAST_MODE_SWITCH = '[data-test="contrast-mode-switch"]';

const openThemeMenu = (): void => {
  cy.get(THEME_SWITCH).then($toggle => {
    if ($toggle.attr('aria-expanded') !== 'true') {
      cy.wrap($toggle).click();
    }
  });
};

/**
 * Guarantees light color scheme before theme tests.
 * localStorage can leave dark mode on between runs.
 */
Given('the theme is explicitly set to light', () => {
  cy.get(THEME_SWITCH).should('be.visible');
  cy.get('html').then($html => {
    if ($html.hasClass('pf-v6-theme-dark')) {
      openThemeMenu();
      cy.get(COLOR_SCHEME_SWITCH).contains('button', 'Light').click();
      cy.get('html').should('not.have.class', 'pf-v6-theme-dark');
    }
  });
  cy.window().then(win => {
    win.localStorage.removeItem('KIALI_THEME');
    win.localStorage.removeItem('KIALI_CONTRAST_MODE');
  });
  cy.get('html').then($html => {
    if ($html.hasClass('pf-v6-theme-glass') || $html.hasClass('pf-v6-theme-high-contrast')) {
      openThemeMenu();
      cy.get(CONTRAST_MODE_SWITCH).contains('button', 'Default').click();
    }
  });
  cy.get('html').should('not.have.class', 'pf-v6-theme-glass');
  cy.get('html').should('not.have.class', 'pf-v6-theme-high-contrast');
});

When('the user switches to dark theme', () => {
  openThemeMenu();
  cy.get(COLOR_SCHEME_SWITCH).contains('button', 'Dark').click();
  cy.get('html').should('have.class', 'pf-v6-theme-dark');
});

When('the user switches to light theme', () => {
  openThemeMenu();
  cy.get(COLOR_SCHEME_SWITCH).contains('button', 'Light').click();
  cy.get('html').should('not.have.class', 'pf-v6-theme-dark');
});

When('the user selects glass contrast mode', () => {
  openThemeMenu();
  cy.get(CONTRAST_MODE_SWITCH).contains('button', 'Glass').click();
});

When('the user selects high contrast mode', () => {
  openThemeMenu();
  cy.get(CONTRAST_MODE_SWITCH).contains('button', 'High contrast').click();
});

When('the user selects default contrast mode', () => {
  openThemeMenu();
  cy.get(CONTRAST_MODE_SWITCH).contains('button', 'Default').click();
});

Then('the document should use light theme', () => {
  cy.get('html').should('not.have.class', 'pf-v6-theme-dark');
});

Then('the document should use dark theme', () => {
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
