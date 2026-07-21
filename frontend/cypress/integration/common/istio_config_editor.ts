import { When, Then } from '@badeball/cypress-cucumber-preprocessor';

const editIstioConfigYaml = (): void => {
  cy.get('[data-test="istio-config-editor"] .monaco-editor').should('be.visible');
  cy.window().then((win: any) => {
    const monaco = win.monaco;
    const editors = monaco.editor.getEditors();
    const ed = editors[editors.length - 1];
    const model = ed.getModel();
    const lastLine = model.getLineCount();
    const lastCol = model.getLineMaxColumn(lastLine);
    ed.executeEdits('cypress-test', [{ range: new monaco.Range(lastLine, lastCol, lastLine, lastCol), text: '     ' }]);
  });
  // Wait for React to process the isModified state change before proceeding
  cy.get('button').contains('Save').should('not.be.disabled');
};

When('user updates the {string} AuthorizationPolicy using the text field', (name: string) => {
  cy.intercept('PATCH', `**/api/namespaces/bookinfo/istio/security.istio.io/v1/AuthorizationPolicy/${name}*`, {
    statusCode: 200
  }).as(`${name}-update`);
  editIstioConfigYaml();
  cy.get('button').contains('Save').should('not.be.disabled').click();
});

When('user edits the Istio config YAML', () => {
  editIstioConfigYaml();
});

When('user clicks the Istio config Reload button', () => {
  cy.getBySel('reload-istio-config').click();
});

When('user clicks the Istio config Cancel button', () => {
  cy.getBySel('cancel-istio-config').click();
});

When('user cancels the unsaved changes modal', () => {
  cy.getBySel('cancel-unsaved').click();
});

Then('user sees the unsaved changes modal for {string}', (action: string) => {
  cy.getBySel('unsaved-changes-modal').should('be.visible');
  cy.getBySel('confirm-unsaved').should('contain.text', action);
});

Then('user does not see the unsaved changes modal', () => {
  cy.getBySel('unsaved-changes-modal').should('not.exist');
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
