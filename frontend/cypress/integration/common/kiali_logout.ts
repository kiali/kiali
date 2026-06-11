import { Given, Then } from '@badeball/cypress-cucumber-preprocessor';

const auth_strategy = Cypress.env('AUTH_STRATEGY');

Given('user clicks on admin', () => {
  if (auth_strategy === 'openshift') {
    cy.getBySel('user-dropdown').click();
  }
});

Given('user logout successfully', () => {
  if (auth_strategy === 'openshift') {
    cy.intercept('**/api/logout').as('logout');
    cy.getBySel('user-logout').click();
  }
});

Then('user verify the logout', () => {
  if (auth_strategy === 'openshift') {
    cy.wait('@logout').its('response.statusCode').should('eq', 204);
  }
});
