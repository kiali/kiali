import { When } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';

When('user selects the {string} namespace', (namespace: string) => {
  cy.getBySel('namespace-dropdown').click();
  cy.get(`input[type="checkbox"][value="${namespace}"]`).check();
  cy.getBySel('namespace-dropdown').click();
  ensureKialiFinishedLoading();
});
