import { Then } from '@badeball/cypress-cucumber-preprocessor';

Then('user can see istio config editor', () => {
  cy.get('#ace-editor').should('be.visible');
});
