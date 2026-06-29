import { When, Then } from '@badeball/cypress-cucumber-preprocessor';

When('user updates the {string} AuthorizationPolicy using the text field', (name: string) => {
  cy.intercept('PATCH', `**/api/namespaces/bookinfo/istio/security.istio.io/v1/AuthorizationPolicy/${name}*`, {
    statusCode: 200
  }).as(`${name}-update`);
  cy.get('[data-test="istio-config-editor"] .monaco-editor textarea.inputarea')
    .should('exist')
    .type('{end}     ', { force: true })
    .then(() => {
      cy.get('button').contains('Save').click();
    });
});

When('user chooses to delete the object', () => {
  cy.get('button').contains('Actions').click();
  cy.contains('Delete').should('be.visible');
  cy.contains('Delete').click();
  cy.contains('Confirm Delete').should('be.visible');
  cy.get('button').contains('Delete').click();
});

Then('user can see istio config editor', () => {
  cy.get('[data-test="istio-config-editor"] .monaco-editor').should('be.visible');
});

Then('cluster badge for {string} cluster should be visible in the Istio config side panel', (cluster: string) => {
  cy.get('#pfbadge-C').parent().parent().should('contain.text', cluster);
});

Then('the {string} configuration should be updated', (name: string) => {
  cy.wait(`@${name}-update`).should('exist');
});
