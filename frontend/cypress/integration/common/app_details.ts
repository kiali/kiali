import { And, Then } from 'cypress-cucumber-preprocessor/steps';
import { getCellsForCol } from './table';

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
    // HOCs can match the component name. This filters the HOCs for just the bare component.
    .then((metricsComponents: any) => metricsComponents.filter(component => component.name === 'IstioMetrics')[0])
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
    // HOCs can match the component name. This filters the HOCs for just the bare component.
    .then((metricsComponents: any) => metricsComponents.filter(component => component.name === 'IstioMetrics')[0])
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
  cy.getBySel('jaeger-scatterplot');
  cy.contains('No traces').should('not.exist');
  cy.getReact('TracesComponent')
    .nthNode(1)
    .getCurrentState()
    .then(state => {
      cy.wrap(state.traces).should('not.be.empty');
      cy.wrap(state.jaegerErrors).should('be.undefined');
    });
});

And('user sees trace details after selecting a trace', () => {
  // First ensure the trace details tab isn't already on the screen.
  cy.getBySel('trace-details-tabs').should('not.exist');
  // The traces component has fully loaded once 'Traces' is visible.
  cy.getBySel('jaeger-scatterplot').contains('Traces');
  // Blue dot on scatterplot is a trace so find one and click on it.
  const tracingDotQuery = '[style*="fill: var(--pf-global--palette--blue-200)"][style*="stroke: transparent;"]';
  cy.getBySel('jaeger-scatterplot').find(`path${tracingDotQuery}`).first().should('be.visible').click({ force: true });
  cy.getBySel('trace-details-tabs').should('be.visible');
  cy.getBySel('trace-details-kebab').click().contains('View on Graph');
});

And('user sees span details after selecting a trace', () => {
  // First ensure the trace details tab isn't already on the screen.
  cy.getBySel('trace-details-tabs').should('not.exist');
  // The traces component has fully loaded once 'Traces' is visible.
  cy.getBySel('jaeger-scatterplot').contains('Traces');
  // Blue dot on scatterplot is a trace so find one and click on it.
  const tracingDotQuery = '[style*="fill: var(--pf-global--palette--blue-200)"][style*="stroke: transparent"]';
  cy.getBySel('jaeger-scatterplot').find(`path${tracingDotQuery}`).first().should('be.visible').click({ force: true });
  cy.getBySel('trace-details-tabs').should('be.visible').contains('Span Details').click();
});

And('user can filter spans by app', () => {
  cy.get('select[aria-label="filter_select_type"]').select('App');
  cy.get('input[placeholder="Filter by App"]').type('productpage{enter}');
  getCellsForCol('App / Workload').each($cell => {
    cy.wrap($cell).contains('productpage');
  });
  // TODO: Assert that something has opened after clicking. There is currently
  // a bug where the kebab doesn't do anything when clicked.
  getCellsForCol(4).first().click();
});
