import { And } from 'cypress-cucumber-preprocessor/steps';

And('Kiali is done loading', () => {
  cy.get('#loading_kiali_spinner').should('not.exist');
});
