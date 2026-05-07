import { Given, Then } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';

Given('user is at the details page for the {string} namespace', (ns: string) => {
  cy.visit({
    url: `/console/namespaces/${ns}`,
    qs: { refresh: '0' }
  });
  ensureKialiFinishedLoading();
});

Then('user sees the namespace detail overview for {string}', (ns: string) => {
  cy.get(`[data-test="namespace-detail-overview-${ns}"]`).should('exist');
});

Then('user sees the title {string} in the namespace detail page', (name: string) => {
  cy.get('[data-test="namespace-detail-title-row"]').contains(name).should('be.visible');
});

Then('the details card has a {string} entry', (term: string) => {
  cy.get('[data-test="namespace-details-card"]').contains(term).should('be.visible');
});

Then('user sees the {string} card', (title: string) => {
  const testId =
    title === 'Resources'
      ? 'namespace-resources-card'
      : title === 'Labels'
      ? 'namespace-labels-card'
      : title === 'Annotations'
      ? 'namespace-annotations-card'
      : '';
  cy.get(`[data-test="${testId}"]`).should('exist');
});

Then('user sees resource links for {string}', (resource: string) => {
  cy.get('[data-test="namespace-resources-card"]').contains('a', resource).should('be.visible');
});
