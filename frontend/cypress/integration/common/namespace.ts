import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';

When('user selects the {string} namespace', (namespace: string) => {
  cy.getBySel('namespace-dropdown').click();
  cy.get(`input[type="checkbox"][value="${namespace}"]`).check();
  cy.getBySel('namespace-dropdown').click();

  ensureKialiFinishedLoading();
});

Then('the namespace dropdown is sorted alphabetically', () => {
  cy.getBySel('namespace-dropdown').click();
  cy.get('input[type="checkbox"]').should('have.length.greaterThan', 1);
  cy.get('input[type="checkbox"]').then($checkboxes => {
    const namespaces = Array.from($checkboxes)
      .filter(checkbox => checkbox.getAttribute('value') !== null)
      .map(checkbox => checkbox.getAttribute('value'));
    const sortedNamespaces = namespaces.slice().sort();
    expect(namespaces).to.deep.equal(sortedNamespaces);
  });
});
