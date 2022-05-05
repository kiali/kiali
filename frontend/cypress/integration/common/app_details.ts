import { Then } from 'cypress-cucumber-preprocessor/steps';

const APP = 'details';
const NAMESPACE = 'bookinfo';

Then('user sees details information for app', () => {
  cy.getBySel('app-description-card').within(() => {
    cy.get('#pfbadge-A').parent().parent().contains('details'); // App
    cy.get('#pfbadge-W').parent().parent().contains('details-v1'); // Workload
    cy.get('#pfbadge-S').parent().parent().contains('details'); // Service
  });
});

Then('user sees a minigraph', () => {
  cy.getBySel('mini-graph');
});

function openTab(tab: string) {
  cy.get('#basic-tabs').should('be.visible').contains(tab).click();
}

Then('user sees inbound and outbound traffic information', () => {
  openTab('Traffic');
  cy.contains('Inbound Traffic');
  // Details app should have some inbound traffic.
  cy.contains('No Inbound Traffic').should('not.exist');
  cy.contains('Outbound Traffic');
});

Then('user sees inbound metrics information', () => {
  cy.intercept(Cypress.config('baseUrl') + `/api/namespaces/${NAMESPACE}/apps/${APP}/dashboard*`).as('fetchMetrics');
  openTab('Inbound Metrics');
  cy.wait('@fetchMetrics');
  cy.waitForReact(1000, '#root');
  cy.getReact('IstioMetrics', { props: { 'data-test': 'inbound-metrics-component' } })
    // Theres be multiple components of the same name providing state through redux/hooks.
    // This gets us the one we we want but this tests will fail if the context providers
    // change names or are removed.
    .nthNode(2)
    .getCurrentState()
    .then(state => {
      cy.wrap(state.dashboard).should('not.be.empty');
    });
});

Then('user sees outbound metrics information', () => {
  cy.intercept(Cypress.config('baseUrl') + `/api/namespaces/${NAMESPACE}/apps/${APP}/dashboard*`).as('fetchMetrics');
  openTab('Outbound Metrics');
  cy.wait('@fetchMetrics');
  cy.waitForReact(1000, '#root');
  cy.getReact('IstioMetrics', { props: { 'data-test': 'outbound-metrics-component' } })
    .nthNode(2)
    .getCurrentState()
    .then(state => {
      cy.wrap(state.dashboard).should('not.be.empty');
    });
});

Then('user sees trace information', () => {
  cy.intercept(Cypress.config('baseUrl') + `/api/namespaces/${NAMESPACE}/apps/${APP}/traces*`).as('fetchTraces');
  openTab('Traces');
  cy.wait('@fetchTraces');
  cy.waitForReact(1000, '#root');
  cy.getReact('TracesComponent')
    .nthNode(1)
    .getCurrentState()
    .then(state => {
      cy.wrap(state.traces).should('not.be.empty');
      cy.wrap(state.jaegerErrors).should('be.undefined');
    });
});
