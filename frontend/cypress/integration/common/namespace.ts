import { And } from 'cypress-cucumber-preprocessor/steps';
import { ensureKialiFinishedLoading } from './transition';

And('user selects the {string} namespace', (namespace: string) => {
  cy.getBySel('namespace-dropdown').click();
  cy.get(`input[type="checkbox"][value="${namespace}"]`).click();
  cy.getBySel('namespace-dropdown').click();
  ensureKialiFinishedLoading();
});
