import { When } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';

When('user selects all namespaces', () => {
  cy.getBySel('namespace-dropdown').click();
  cy.get(`input[type="checkbox"][id="bulk-select-id"]`).check();
  cy.getBySel('namespace-dropdown').click();

  ensureKialiFinishedLoading();
});

When('the user refreshes the page', () => {
  cy.get('[data-test="refresh-button"]').click();

  measureKialiFinishedLoading();
});

export const measureKialiFinishedLoading = (): void => {
  cy.get('#loading_kiali_spinner').should('not.exist');
};
