import { Given, And, Then } from '@badeball/cypress-cucumber-preprocessor';

const url = '/';

And('I open Kiali URL', () => {
  cy.visit(url);
});

Then(`I see {string} in the title`, title => {
  cy.title().should('include', title);
});
