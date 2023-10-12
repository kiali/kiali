import { And, Then, But } from '@badeball/cypress-cucumber-preprocessor';
import { getCellsForCol } from './table';
import { openTab } from './transition';
import { clusterParameterExists } from './navigation';

Then('user sees details information for the remote {string} app', (name: string) => {
  cy.getBySel('app-description-card').within(() => {
    cy.get('#pfbadge-A').parent().parent().parent().contains(name)// App
    cy.get('#pfbadge-W').parent().parent().parent().contains(`${name}-v1`); // Workload
    cy.get('#pfbadge-S').parent().parent().parent().contains(name); // Service
    clusterParameterExists(true);
  });
});

Then('user sees {string} metrics information for the remote {string} {string}', (metrics:string, name:string, type:string) => {
  cy.intercept(Cypress.config('baseUrl') + `/api/namespaces/bookinfo/${type}s/${name}/dashboard*`).as('fetchMetrics');
  openTab(`${metrics} Metrics`);
  cy.wait('@fetchMetrics');
  cy.waitForReact(1000, '#root');
  cy.getReact('IstioMetricsComponent', { props: { 'data-test': `${metrics.toLowerCase()}-metrics-component` } })
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

And("user sees {string} from a remote {string} cluster",(type:string, cluster:string) => {
  cy.waitForReact();
  cy.getReact('CytoscapeGraph')
  .should('have.length', '1')
  .getCurrentState()
  .then(state => {
    const apps = state.cy.nodes(`[cluster="${cluster}"][nodeType="${type}"][namespace="bookinfo"]`).length; 
      assert.isAbove(apps,0);
   });
});

And ("user should see columns related to cluster info for the inbound and outbound traffic", () => {
  cy.get(`th[data-label="Cluster"]`).should('be.visible').and('have.length',2);
});
