import { When, Then } from '@badeball/cypress-cucumber-preprocessor';
import { getCellsForCol } from './table';
import { clusterParameterExists } from './navigation';

const openTab = (tab: string): void => {
  cy.get('#basic-tabs').should('be.visible').contains(tab).click();
};

const openEnvoyTab = (tab: string): void => {
  cy.get('#envoy-details').should('be.visible').contains(tab).click();
};

Then('user sees details information for workload', () => {
  cy.getBySel('workload-description-card').within(() => {
    cy.get('#pfbadge-A').parent().parent().parent().contains('details'); // App
    cy.get('#pfbadge-W').parent().parent().parent().contains('details-v1'); // Workload
    cy.get('#pfbadge-S').parent().parent().parent().contains('details'); // Service

    clusterParameterExists(false);
  });
});

Then('user sees workload inbound and outbound traffic information', () => {
  openTab('Traffic');

  cy.contains('Inbound Traffic');
  cy.contains('No Inbound Traffic').should('not.exist');
  cy.contains('No Outbound Traffic');
});

Then('user sees workload inbound metrics information', () => {
  cy.intercept(`**/api/namespaces/bookinfo/workloads/details-v1/dashboard*`).as('fetchMetrics');

  openTab('Inbound Metrics');
  cy.wait('@fetchMetrics');
  cy.waitForReact();

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

Then('user sees workload outbound metrics information', () => {
  cy.intercept(`**/api/namespaces/bookinfo/workloads/details-v1/dashboard*`).as('fetchMetrics');

  openTab('Outbound Metrics');
  cy.wait('@fetchMetrics');
  cy.waitForReact();

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

When('user can filter spans by workload {string}', (workload: string) => {
  cy.get('button#filter_select_type-toggle').click();
  cy.get('button#Workload').click();

  cy.get('input[placeholder="Filter by Workload"]').type(`${workload}{enter}`);
  cy.get(`li[label="${workload}"]`).should('be.visible').find('button').click();

  getCellsForCol('App / Workload').each($cell => {
    cy.wrap($cell).contains(workload);
  });

  getCellsForCol(4).first().click();

  // Check that kebab menu is opened
  cy.get('ul[role="menu"]').should('be.visible');
});

When(
  'the user filters by {string} with value {string} on the {string} tab',
  (filter: string, value: string, tab: string) => {
    openTab('Envoy');
    openEnvoyTab(tab);

    cy.waitForReact();

    cy.get('button#filter_select_type-toggle').click();
    cy.contains('div#filter_select_type button', filter).click();

    cy.get('input#filter_input_value').type(`${value}{enter}`);
  }
);

Then('the user sees clusters expected information', () => {
  cy.get('tbody').within(() => {
    cy.contains('td', 'BlackHoleCluster').should('not.exist');
    cy.contains('td', 'details.bookinfo.svc.cluster.local');
  });
});

Then('the user sees listeners expected information', () => {
  cy.get('tbody').within(() => {
    cy.contains('td', 'PassthroughCluster').should('not.exist');
    cy.contains('td', 'Route: 9090');
  });
});

Then('the user sees routes expected information', () => {
  cy.get('tbody').within(() => {
    cy.contains('td', '15010').should('not.exist');
    cy.contains('td', '9080');
  });
});

When('the user looks for the bootstrap tab', () => {
  openTab('Envoy');
  openEnvoyTab('Bootstrap');
});

Then('the user sees bootstrap expected information', () => {
  cy.get('[id="ace-editor"]').contains('bootstrap');
});

When('the user looks for the config tab', () => {
  openTab('Envoy');
  openEnvoyTab('Config');
});

Then('the user sees config expected information', () => {
  cy.get('[id="ace-editor"]').contains('config_dump');
});

Then('the user sees the metrics tab', () => {
  cy.intercept(`**/api/namespaces/bookinfo/customdashboard/envoy*`).as('fetchEnvoyMetrics');

  openTab('Envoy');
  openEnvoyTab('Metrics');

  cy.wait('@fetchEnvoyMetrics');
  cy.waitForReact();

  cy.contains('Loading metrics').should('not.exist');

  cy.getReact('CustomMetricsComponent', { props: { 'data-test': 'envoy-metrics-component' } })
    .then(
      (metricsComponents: any) => metricsComponents.filter(component => component.name === 'CustomMetricsComponent')[0]
    )
    .getCurrentState()
    .then(state => {
      cy.wrap(state.dashboard).should('not.be.empty');
    });
});

Then('the user can see the {string} link', (link: string) => {
  cy.getBySel('view-in-tracing').contains(link);
});

Then('the user can see the {string} trace link', (link: string) => {
  cy.getBySel('trace-details-tabs').should('be.visible');
  cy.getBySel('trace-details-kebab').click();
  cy.getBySel('trace-details-dropdown').contains(link);
});

Then('the user can see the {string} span link', (link: string) => {
  cy.get('table')
    .should('be.visible')
    .find('tbody tr') // ignore thead rows
    .should('have.length.above', 1) // retries above cy.find() until we have a non head-row
    .eq(1) // take 1st  row
    .find('td')
    .eq(4) // take 5th cell (Kebab)
    .find('button')
    .click();

  cy.get('ul[role=menu]').contains(link);
});

Then('user sees {string} badge', (badge: string) => {
  cy.getBySel('workload-description-card').within(() => {
    cy.get('.pf-v5-c-label__content').contains(badge);
  });
});

Then(
  'the user cannot see the {string} badge for {string} workload in {string} namespace',
  (badge: string, workload: string, ns: string) => {
    cy.getBySel('workload-description-card').within(() => {
      cy.get(`[data-test="${badge}-badge-for-${workload}-workload-in-${ns}-namespace"]`).should('not.exist');
    });
  }
);
