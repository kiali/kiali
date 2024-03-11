import { When } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';

When('user selects the {string} namespace', (namespace: string) => {
  cy.getBySel('namespace-dropdown').click();
  cy.get(`input[type="checkbox"][value="${namespace}"]`).check();
  cy.getBySel('namespace-dropdown').click();

  ensureKialiFinishedLoading();
});

When('user selects the {string} namespace and waits for services', (namespace: string) => {
  cy.intercept(`${Cypress.config('baseUrl')}/api/clusters/services`).as('fetchServices');

  cy.getBySel('namespace-dropdown').click();
  cy.get(`input[type="checkbox"][value="${namespace}"]`).check();
  cy.getBySel('namespace-dropdown').click();

  cy.wait('@fetchServices');
  cy.waitForReact(1000, '#root');

  ensureKialiFinishedLoading();
});
