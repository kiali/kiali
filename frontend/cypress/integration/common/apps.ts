/*
  This file has step definitions for the apps list page as well as
  step definitions that are shared between app, workload, and service
  pages since these are all similar.
*/

import { Step, Then, When, Given } from '@badeball/cypress-cucumber-preprocessor';
import {
  checkHealthIndicatorInTable,
  checkHealthStatusInTable,
  colExists,
  ensureObjectsInTable,
  getColWithRowText,
  hasAtLeastOneClass
} from './table';
import { openTab } from './transition';

// Choosing a random bookinfo app to test with.
const APP = 'details';
const CLUSTER1_CONTEXT = Cypress.env('CLUSTER1_CONTEXT');
const CLUSTER2_CONTEXT = Cypress.env('CLUSTER2_CONTEXT');

Then('user sees trace information', () => {
  openTab('Traces');

  cy.getBySel('tracing-scatterplot');

  // Ensures a trace hasn't been clicked on yet.
  cy.getBySel('trace-details-tabs').should('not.exist');

  // Ensures traces have loaded.
  cy.getBySel('tracing-scatterplot').contains('Traces');
});

Then('user sees trace details', () => {
  cy.getBySel('trace-details-tabs').should('be.visible');
  cy.getBySel('trace-details-kebab').click();
  cy.getBySel('trace-details-dropdown').contains('View on Graph');
});

When('user selects a trace', () => {
  const tracingDotQuery =
    '[style*="fill: var(--pf-v5-global--palette--blue-200)"][style*="stroke: var(--pf-v5-chart-scatter--data--stroke--Color, transparent)"]';

  cy.getBySel('tracing-scatterplot').find(`path${tracingDotQuery}`).first().should('be.visible').click({ force: true });
});

Then('user sees span details', () => {
  cy.getBySel('trace-details-tabs').should('be.visible').contains('Span Details').click({ scrollBehavior: false });

  cy.get('table')
    .should('be.visible')
    .find('tbody tr') // ignore thead rows
    .should('have.length.above', 1) // retries above cy.find() until we have a non head-row
    .eq(1) // take 1st  row
    .find('td')
    .eq(4) // take 5th cell (kebab)
    .should('be.visible');

  cy.get('table')
    .should('be.visible')
    .find('tbody tr') // ignore thead rows
    .should('have.length.above', 1) // retries above cy.find() until we have a non head-row
    .eq(1) // take 1st  row
    .find('td')
    .eq(3) // take 4th cell (Statistics)
    .children('button')
    .should('not.exist'); // Load Statistics button should not exist when metrics are loaded
});

When('I fetch the list of applications', () => {
  cy.visit('/console/applications?refresh=0');
});

When('user opens the namespace dropdown', () => {
  cy.intercept(`${Cypress.config('baseUrl')}/api/namespaces/`).as('getNamespaces');
  cy.get('[data-test="namespace-dropdown"]').click();
});

Then('user sees Health information for Apps', () => {
  getColWithRowText(APP, 'Health')
    .find('span')
    .filter('.pf-v5-c-icon')
    .should('satisfy', hasAtLeastOneClass(['icon-healthy', 'icon-unhealthy', 'icon-degraded', 'icon-na']));
});

Then('user sees all the Apps in the bookinfo namespace', () => {
  ensureObjectsInTable('details', 'kiali-traffic-generator', 'productpage', 'ratings', 'reviews');
});

Then('user sees Name information for Apps', () => {
  // There should be a table with a heading for each piece of information.
  getColWithRowText(APP, 'Name').within(() => {
    cy.get(`a[href*="/namespaces/bookinfo/applications/${APP}"]`).should('be.visible');
  });
});

Then('user sees Namespace information for Apps', () => {
  getColWithRowText(APP, 'Namespace').contains('bookinfo');
});

Then('user sees Labels information for Apps', () => {
  getColWithRowText(APP, 'Labels').contains('app=details');
  getColWithRowText(APP, 'Labels').contains('service=details');
  getColWithRowText(APP, 'Labels').contains('version=v1');
});

Then('user sees Details information for Apps', () => {
  getColWithRowText(APP, 'Details').within(() => {
    cy.contains('bookinfo-gateway');

    cy.get(`a[href*="/namespaces/bookinfo/istio/gateways/bookinfo-gateway"]`).should('be.visible');
  });
});

Then('user only sees the apps with the {string} name in the {string} namespace', (name: string, ns: string) => {
  let count: number;

  cy.request('GET', `/api/namespaces/${ns}/apps`).should(response => {
    count = response.body.applications.filter(item => item.name.includes(name)).length;
  });

  cy.get('tbody').within(() => {
    cy.contains('No apps found').should('not.exist');
    cy.get('tr').should('have.length', count);
  });
});

// This is somewhat vague because there's no guarantee that all the bookinfo apps are
// going to be healthy when the test is run but at least some of them should be.
Then('user only sees healthy apps', () => {
  cy.get('tbody').within(() => {
    cy.get('tr')
      .find('span')
      .filter('.pf-v5-c-icon')
      .should('satisfy', hasAtLeastOneClass(['icon-healthy']));
  });
});

Then('the application should be listed as {string}', function (healthStatus: string) {
  checkHealthIndicatorInTable(this.targetNamespace, null, this.targetApp, healthStatus);
});

Then('the health status of the application should be {string}', function (healthStatus: string) {
  checkHealthStatusInTable(this.targetNamespace, null, this.targetApp, healthStatus);
});

Then('user sees all the Apps toggles', () => {
  cy.get('[data-test="toggle-health"]').should('be.checked');
  cy.get('[data-test="toggle-istioResources"]').should('be.checked');

  colExists('Health', true);
  colExists('Details', true);
});

When('user {string} toggle {string}', (action: 'checks' | 'unchecks', toggle: string) => {
  if (action === 'checks') {
    cy.get(`[data-test="toggle-${toggle}"]`).check();
  } else {
    cy.get(`[data-test="toggle-${toggle}"]`).uncheck();
  }
});

Then('the {string} column {string}', (col: string, action: 'appears' | 'disappears') => {
  colExists(col, action === 'appears');
});

Then('user may only see {string}', (sees: string) => {
  cy.get('tbody').within(() => {
    cy.get('tr').should('have.length', 1);

    cy.get('td').then(td => {
      if (td.length === 1) {
        cy.get('h5').contains('No applications found');
      } else {
        cy.contains('tr', sees);
      }
    });
  });
});

Then('user should see no duplicate namespaces', () => {
  cy.exec(`kubectl get namespaces bookinfo --context ${CLUSTER1_CONTEXT}`);
  cy.exec(`kubectl get namespaces bookinfo --context ${CLUSTER2_CONTEXT}`);

  cy.get('[data-test="namespace-dropdown"]').siblings().contains('bookinfo').should('be.visible').and('have.length', 1);
});

// And user clicks on the "reviews" <type> from the "west" cluster visible in the graph
Given(
  'the {string} {string} from the {string} cluster is visible in the minigraph',
  (name: string, type: string, cluster: string) => {
    Step(this, 'user sees a minigraph');
    cy.waitForReact();
    cy.getReact('CytoscapeGraph')
      .should('have.length', '1')
      .then($graph => {
        cy.wrap($graph)
          .getProps()
          .then(props => {
            const graphType = props.graphData.fetchParams.graphType;
            const { nodeType, isBox } = nodeInfo(type, graphType);
            cy.wrap($graph)
              .getCurrentState()
              .then(state => {
                cy.wrap(
                  state.cy
                    .nodes()
                    .some(
                      node =>
                        node.data('nodeType') === nodeType &&
                        node.data('namespace') === 'bookinfo' &&
                        node.data(type) === name &&
                        node.data('cluster') === cluster &&
                        node.data('isBox') === isBox
                    )
                ).should('be.true');
              });
          });
      });
  }
);

// node type and box type varies based on the graph so this is a helper function to get the right values.
const nodeInfo = (nodeType: string, graphType: string): { isBox?: string; nodeType: string } => {
  let isBox: string | undefined;
  if (nodeType === 'app') {
    // Apps are boxes in versioned app graph...
    nodeType = 'box';
    isBox = 'app';
  } else if (nodeType === 'workload' && graphType === 'versionedApp') {
    // Workloads are apps in versioned app graph...
    nodeType = 'app';
  }

  return {
    nodeType,
    isBox
  };
};

When(
  'user clicks on the {string} {string} from the {string} cluster in the graph',
  (name: string, type: string, cluster: string) => {
    cy.waitForReact();
    cy.getReact('CytoscapeGraph')
      .should('have.length', '1')
      .then($graph => {
        cy.wrap($graph)
          .getProps()
          .then(props => {
            const graphType = props.graphData.fetchParams.graphType;
            cy.wrap($graph)
              .getCurrentState()
              .then(state => {
                const node = state.cy
                  .nodes()
                  .toArray()
                  .find(node => {
                    const { nodeType, isBox } = nodeInfo(type, graphType);
                    return (
                      node.data('nodeType') === nodeType &&
                      node.data('namespace') === 'bookinfo' &&
                      node.data(type) === name &&
                      node.data('cluster') === cluster &&
                      node.data('isBox') === isBox
                    );
                  });
                node.emit('tap');
              });
          });
      });
  }
);
