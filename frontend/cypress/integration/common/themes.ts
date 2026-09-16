import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';

const THEME_DROPDOWN = '[data-test="theme-dropdown"]';
const COLOR_SCHEME_TOGGLE = '[data-test="color-scheme-toggle"]';
const CONTRAST_MODE_TOGGLE = '[data-test="contrast-mode-toggle"]';
const THEME_TOGGLE = '[data-test="theme-toggle"]';

const openAppearanceMenu = (): void => {
  cy.get(THEME_DROPDOWN).then($toggle => {
    if ($toggle.attr('aria-expanded') !== 'true') {
      cy.wrap($toggle).click();
    }
  });
};

/**
 * Resets appearance to defaults (light color scheme, default contrast, default theme).
 * Clears persisted appearance preferences so prior runs do not leak state.
 */
Given('the color scheme is explicitly set to light', () => {
  cy.get(THEME_DROPDOWN).should('be.visible');
  cy.get('html').then($html => {
    if ($html.hasClass('pf-v6-theme-dark')) {
      openAppearanceMenu();
      cy.get(COLOR_SCHEME_TOGGLE).contains('button', 'Light').click();
      cy.get('html').should('not.have.class', 'pf-v6-theme-dark');
    }
  });
  cy.window().then(win => {
    win.localStorage.removeItem('KIALI_COLOR_SCHEME');
    win.localStorage.removeItem('KIALI_CONTRAST_MODE');
    win.localStorage.removeItem('KIALI_THEME');
  });
  cy.get('html').then($html => {
    if (
      $html.hasClass('pf-v6-theme-glass') ||
      $html.hasClass('pf-v6-theme-high-contrast') ||
      $html.hasClass('pf-v6-theme-felt')
    ) {
      openAppearanceMenu();
      if ($html.hasClass('pf-v6-theme-felt')) {
        cy.get(THEME_TOGGLE).contains('button', 'Default').click();
      }
      if ($html.hasClass('pf-v6-theme-glass') || $html.hasClass('pf-v6-theme-high-contrast')) {
        cy.get(CONTRAST_MODE_TOGGLE).contains('button', 'Default').click();
      }
    }
  });
  cy.get('html').should('not.have.class', 'pf-v6-theme-glass');
  cy.get('html').should('not.have.class', 'pf-v6-theme-high-contrast');
  cy.get('html').should('not.have.class', 'pf-v6-theme-felt');
});

When('the user switches to dark color scheme', () => {
  openAppearanceMenu();
  cy.get(COLOR_SCHEME_TOGGLE).contains('button', 'Dark').click();
  cy.get('html').should('have.class', 'pf-v6-theme-dark');
});

When('the user switches to light color scheme', () => {
  openAppearanceMenu();
  cy.get(COLOR_SCHEME_TOGGLE).contains('button', 'Light').click();
  cy.get('html').should('not.have.class', 'pf-v6-theme-dark');
});

When('the user selects glass contrast mode', () => {
  openAppearanceMenu();
  cy.get(CONTRAST_MODE_TOGGLE).contains('button', 'Glass').click();
});

When('the user selects high contrast mode', () => {
  openAppearanceMenu();
  cy.get(CONTRAST_MODE_TOGGLE).contains('button', 'High contrast').click();
});

When('the user selects default contrast mode', () => {
  openAppearanceMenu();
  cy.get(CONTRAST_MODE_TOGGLE).contains('button', 'Default').click();
});

When('the user selects project felt theme', () => {
  openAppearanceMenu();
  cy.get(THEME_TOGGLE).contains('button', 'Project Felt').click();
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

Then('the document should use project felt theme', () => {
  cy.get('html').should('have.class', 'pf-v6-theme-felt');
});
