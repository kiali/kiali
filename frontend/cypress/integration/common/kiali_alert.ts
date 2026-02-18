import { Then } from '@badeball/cypress-cucumber-preprocessor';

Then(`user should see no Istio Components Status`, () => {
  cy.intercept({
    pathname: '**/api/istio/status*',
    query: {
      objects: ''
    }
  }).as('istioStatus');

  // Wait for page to fully load before clicking refresh
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.get('[data-test="refresh-button"]').click();
  cy.wait('@istioStatus');
  cy.waitForReact();

  cy.get('[data-test="istio-status-danger"]', { timeout: 1000 }).should('not.exist');
  cy.get('[data-test="istio-status-warning"]', { timeout: 1000 }).should('not.exist');
});
