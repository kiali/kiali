import { Then } from '@badeball/cypress-cucumber-preprocessor';
import { getCellsForCol } from './table';
import { openTab } from './transition';

const APP = 'details';
const NAMESPACE = 'bookinfo';

Then('user sees details information for the {string} app', (name: string) => {
  cy.getBySel('app-description-card').within(() => {
    cy.get('#pfbadge-A').parent().parent().contains(`${name}`); // App
    cy.get('#pfbadge-W').parent().parent().contains(`${name}-v1`); // Workload
    cy.get('#pfbadge-S').parent().parent().contains(`${name}`); // Service
  });
});

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
  cy.getReact('IstioMetricsComponent', { props: { 'data-test': 'inbound-metrics-component' } })
    // HOCs can match the component name. This filters the HOCs for just the bare component.
    .then(
      (metricsComponents: any) => metricsComponents.filter(component => component.name === 'IstioMetricsComponent')[0]
    )
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
  cy.getReact('IstioMetricsComponent', { props: { 'data-test': 'outbound-metrics-component' } })
    // HOCs can match the component name. This filters the HOCs for just the bare component.
    .then(
      (metricsComponents: any) => metricsComponents.filter(component => component.name === 'IstioMetricsComponent')[0]
    )
    .getCurrentState()
    .then(state => {
      cy.wrap(state.dashboard).should('not.be.empty');
    });
});

Then('user can filter spans by app', () => {
  cy.get('select[aria-label="filter_select_type"]').select('App');
  cy.get('input[placeholder="Filter by App"]').type('productpage{enter}');
  cy.get('button[label="productpage"]').should('be.visible').click();
  getCellsForCol('App / Workload').each($cell => {
    cy.wrap($cell).contains('productpage');
  });
  // TODO: Assert that something has opened after clicking. There is currently
  // a bug where the kebab doesn't do anything when clicked.
  getCellsForCol(4).first().click();
});
