import { Then } from '@badeball/cypress-cucumber-preprocessor';

Then('user can see istio config editor', () => {
  cy.get('#ace-editor').should('be.visible');
});

Then('cluster badge for {string} cluster should be visible in the Istio config side panel',(cluster:string) => {
  cy.get('#pfbadge-C').parent().parent().should('contain.text',cluster);
});