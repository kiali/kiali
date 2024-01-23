import { When, Then } from '@badeball/cypress-cucumber-preprocessor';

When('user updates the configuration in the text field', () => {
  // let editor = ace.edit("ace-editor");
  // editor.setValue(editor.getValue() + '\n');
});

Then('user can see istio config editor', () => {
  cy.get('#ace-editor').should('be.visible');
});

Then('cluster badge for {string} cluster should be visible in the Istio config side panel',(cluster:string) => {
  cy.get('#pfbadge-C').parent().parent().should('contain.text',cluster);
});