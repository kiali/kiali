import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';

const THEME_SWITCH = '[data-test="theme-switch"]';
const THEME_SWITCH_DARK = 'button[aria-label="Dark theme"]';
const THEME_SWITCH_LIGHT = 'button[aria-label="Light theme"]';
const CONTRAST_DEFAULT = 'button[aria-label="Default contrast"]';
const CONTRAST_GLASS = 'button[aria-label="Glass theme"]';
const CONTRAST_HIGH = 'button[aria-label="High contrast"]';

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

Given('the contrast mode is explicitly set to default', () => {
  cy.get(THEME_SWITCH).should('be.visible');
  cy.get('html').then($html => {
    if ($html.hasClass('pf-v6-theme-glass') || $html.hasClass('pf-v6-theme-high-contrast')) {
      cy.get(CONTRAST_DEFAULT).click();
      cy.get('html').should('not.have.class', 'pf-v6-theme-glass');
      cy.get('html').should('not.have.class', 'pf-v6-theme-high-contrast');
    }
  });
  cy.window().then(win => win.localStorage.removeItem('KIALI_CONTRAST_MODE'));
});

When('the user switches to dark theme', () => {
  cy.get(THEME_SWITCH_DARK).click();
  cy.get('html').should('have.class', 'pf-v6-theme-dark');
});

When('the user switches to light theme', () => {
  cy.get(THEME_SWITCH_LIGHT).click();
  cy.get('html').should('not.have.class', 'pf-v6-theme-dark');
});

When('the user switches to glass contrast mode', () => {
  cy.get(CONTRAST_GLASS).click();
  cy.get('html').should('have.class', 'pf-v6-theme-glass');
});

When('the user switches to high contrast mode', () => {
  cy.get(CONTRAST_HIGH).click();
  cy.get('html').should('have.class', 'pf-v6-theme-high-contrast');
});

When('the user switches to default contrast mode', () => {
  cy.get(CONTRAST_DEFAULT).click();
  cy.get('html').should('not.have.class', 'pf-v6-theme-glass');
  cy.get('html').should('not.have.class', 'pf-v6-theme-high-contrast');
});

Then('the document should use light theme', () => {
  cy.get('html').should('not.have.class', 'pf-v6-theme-dark');
});

Then('the document should use dark theme', () => {
  cy.get('html').should('have.class', 'pf-v6-theme-dark');
});

Then('the document should use glass contrast mode', () => {
  cy.get('html').should('have.class', 'pf-v6-theme-glass');
});

Then('the document should use high contrast mode', () => {
  cy.get('html').should('have.class', 'pf-v6-theme-high-contrast');
});

Then('the document should use default contrast mode', () => {
  cy.get('html').should('not.have.class', 'pf-v6-theme-glass');
  cy.get('html').should('not.have.class', 'pf-v6-theme-high-contrast');
});

Then('the document should not use glass contrast mode', () => {
  cy.get('html').should('not.have.class', 'pf-v6-theme-glass');
});

Then('the document should not use high contrast mode', () => {
  cy.get('html').should('not.have.class', 'pf-v6-theme-high-contrast');
});
