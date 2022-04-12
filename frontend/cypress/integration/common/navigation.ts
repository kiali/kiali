import { Given } from 'cypress-cucumber-preprocessor/steps';

Given('user opens the {string} page', (page: string) => {
  // Forcing "Pause" to not cause unhandled promises from the browser when cypress is testing
  cy.visit(Cypress.config('baseUrl') + `/console/${page}?refresh=0`);
});
