import { Given } from '@badeball/cypress-cucumber-preprocessor';
import { Then } from '@badeball/cypress-cucumber-preprocessor';

const url = '/';

Given('I open Kiali URL', () => {
  cy.visit(url);
});

Then(`I see {string} in the title`, title => {
  cy.title().should('include', title);
});
