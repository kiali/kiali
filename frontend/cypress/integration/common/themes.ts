import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';

const THEME_SWITCH = '[data-test="theme-switch"]';
const THEME_SWITCH_DARK = 'button[aria-label="Dark theme"]';
const THEME_SWITCH_LIGHT = 'button[aria-label="Light theme"]';

/**
 * Guarantees light color scheme before theme tests.
 * localStorage can leave dark mode on between runs.
 */
Given('the theme is explicitly set to light', () => {
  cy.get(THEME_SWITCH).should('be.visible');
  cy.get('html').then($html => {
    if ($html.hasClass('pf-v6-theme-dark')) {
      cy.get(THEME_SWITCH_LIGHT).click();
      cy.get('html').should('not.have.class', 'pf-v6-theme-dark');
    }
  });
  cy.window().then(win => win.localStorage.removeItem('KIALI_THEME'));
});

When('the user switches to dark theme', () => {
  cy.get(THEME_SWITCH_DARK).click();
  cy.get('html').should('have.class', 'pf-v6-theme-dark');
});

When('the user switches to light theme', () => {
  cy.get(THEME_SWITCH_LIGHT).click();
  cy.get('html').should('not.have.class', 'pf-v6-theme-dark');
});

Then('the document should use light theme', () => {
  cy.get('html').should('not.have.class', 'pf-v6-theme-dark');
});

Then('the document should use dark theme', () => {
  cy.get('html').should('have.class', 'pf-v6-theme-dark');
});
