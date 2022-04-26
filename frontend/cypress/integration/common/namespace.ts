import { And } from 'cypress-cucumber-preprocessor/steps';

And('user selects the {string} namespace in the NamespaceSelector', (namespace: string) => {
  cy.getBySel('namespace-dropdown').click();
  cy.get(`input[type="checkbox"][value="${namespace}"]`).click();
  cy.getBySel('namespace-dropdown').click();
});
