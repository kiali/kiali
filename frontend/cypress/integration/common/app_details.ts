import { Then } from '@badeball/cypress-cucumber-preprocessor';
import { getCellsForCol } from './table';
import { openTab } from './transition';
import { clusterParameterExists } from './navigation';

const APP = 'details';
const NAMESPACE = 'bookinfo';

Then('user sees details information for the {string} app', (name: string) => {
  cy.getBySel('app-description-card').within(() => {
    cy.get('#pfbadge-A').parent().parent().parent().contains('details'); // App
    cy.get('#pfbadge-W').parent().parent().parent().contains('details-v1'); // Workload
    cy.get('#pfbadge-S').parent().parent().parent().contains('details'); // Service

    clusterParameterExists(false);
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
  cy.intercept(`${Cypress.config('baseUrl')}/api/namespaces/${NAMESPACE}/apps/${APP}/dashboard*`).as('fetchMetrics');

  openTab('Inbound Metrics');
  cy.wait('@fetchMetrics');
  cy.waitForReact(1000, '#root');

  cy.getReact('IstioMetricsComponent', { props: { 'data-test': 'inbound-metrics-component' } })
    // HOCs can match the component name. This filters the HOCs for just the bare component.
    .then(
      (metricsComponents: any) =>
        metricsComponents.filter((component: any) => component.name === 'IstioMetricsComponent')[0]
    )
    .getCurrentState()
    .then(state => {
      cy.wrap(state.dashboard).should('not.be.empty');
    });
});

Then('user sees outbound metrics information', () => {
  cy.intercept(`${Cypress.config('baseUrl')}/api/namespaces/${NAMESPACE}/apps/${APP}/dashboard*`).as('fetchMetrics');

  openTab('Outbound Metrics');
  cy.wait('@fetchMetrics');
  cy.waitForReact(1000, '#root');

  cy.getReact('IstioMetricsComponent', { props: { 'data-test': 'outbound-metrics-component' } })
    // HOCs can match the component name. This filters the HOCs for just the bare component.
    .then(
      (metricsComponents: any) =>
        metricsComponents.filter((component: any) => component.name === 'IstioMetricsComponent')[0]
    )
    .getCurrentState()
    .then(state => {
      cy.wrap(state.dashboard).should('not.be.empty');
    });
});

Then('user can filter spans by app', () => {
  cy.get('select[aria-label="filter_select_type"]').select('App');
  cy.get('input[placeholder="Filter by App"]').type('productpage{enter}');
  cy.get('li[label="productpage"]').should('be.visible').find('button').click();

  getCellsForCol('App / Workload').each($cell => {
    cy.wrap($cell).contains('productpage');
  });

  getCellsForCol(4).first().click();

  // Check that kebab menu is opened
  cy.get('ul[role="menu"]').should('be.visible');
});

Then('no cluster badge for the {string} should be visible', (type: string) => {
  if (type === 'Istio config') {
    cy.get('#pfbadge-C').should('not.exist');
  } else if (type === 'graph side panel') {
    cy.get('#graph-side-panel').within($div => {
      cy.get('#pfbadge-C').should('not.exist');
    });
  } else {
    cy.get(`#${type[0].toUpperCase()}${type.slice(1)}DescriptionCard`).within($article => {
      cy.get('#pfbadge-C').should('not.exist');
    });
  }
});

Then('cluster badge for the {string} should be visible', (type: string) => {
  if (type === 'Istio config') {
    cy.get('#pfbadge-C').should('be.visible');
  } else if (type === 'graph side panel') {
    cy.get('#graph-side-panel').within($div => {
      cy.get('#pfbadge-C').should('be.visible');
    });
  } else {
    cy.get(`#${type[0].toUpperCase()}${type.slice(1)}DescriptionCard`).within($article => {
      cy.get('#pfbadge-C').should('be.visible');
    });
  }
});
