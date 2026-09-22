import { When } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';

/**
 * Shared OSSMC-safe helpers for namespace detail actions that open the
 * NamespaceTrafficPolicies confirmation modal (sidecar injection, ambient, etc.).
 */
export const visitNamespaceDetailPage = (namespace: string): void => {
  if (Cypress.env('OSSMC')) {
    cy.intercept('**/api/namespaces/graph*').as('namespaceMinigraph');
  }
  cy.visit({ url: `/console/namespaces/${namespace}?refresh=0` });
  if (Cypress.env('OSSMC')) {
    cy.wait('@namespaceMinigraph');
  }
  ensureKialiFinishedLoading();
};

export const openNamespaceActionsMenu = (): void => {
  ensureKialiFinishedLoading();
  // Avoid opening the minigraph menu while a confirm modal is still mounted.
  cy.get('[role="dialog"]').should('not.exist');
  if (Cypress.env('OSSMC')) {
    cy.get('button#minigraph-toggle', { timeout: 40000 }).should('be.visible').click();
  } else {
    cy.getBySel('namespace-actions-toggle').should('be.visible').click();
  }
  cy.get('[role="menu"]').should('be.visible');
};

export const confirmNamespaceTrafficPolicyModal = (): void => {
  cy.intercept('PATCH', '**/api/namespaces/**').as('namespacePatch');
  cy.getBySel('confirm-create', { timeout: 10000 }).should('be.visible').should('not.be.disabled').click();
  cy.wait('@namespacePatch');
  cy.get('[role="dialog"]').should('not.exist');
  ensureKialiFinishedLoading();
};

When('user navigates to the namespace detail page for {string}', function (namespace: string) {
  this.targetNamespace = namespace;
  visitNamespaceDetailPage(namespace);
});
