import { Then } from '@badeball/cypress-cucumber-preprocessor';

Then(`user does not see the {string} link`, link => {
  cy.get('div[role="dialog"]').get(`#${link}`).should('not.exist');
});

Then(`user see the {string} link`, link => {
  cy.get('div[role="dialog"]').get(`#${link}`).should('exist');
});
