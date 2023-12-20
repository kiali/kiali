import { Then } from '@badeball/cypress-cucumber-preprocessor';

Then(`user should see no Istio Components Status`, () => {
  cy.intercept({
    pathname: '**/api/istio/status*',
    query: {
      objects: ''
    }
  }).as('istioStatus');

  cy.get('#refresh_button').click();
  cy.wait('@istioStatus');
  cy.waitForReact();

  cy.get('[data-test="istio-status-danger"]', { timeout: 1000 }).should('not.exist');
  cy.get('[data-test="istio-status-warning"]', { timeout: 1000 }).should('not.exist');
});
