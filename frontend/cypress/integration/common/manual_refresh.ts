import { Then } from '@badeball/cypress-cucumber-preprocessor';

Then(`user {string} manual refresh messaging`, (action: string) => {
  if (action === 'sees') {
    cy.get('[data-test="manual-refresh"]').should('exist');
  } else {
    cy.get('[data-test="manual-refresh"]').should('not.exist');
  }
});
