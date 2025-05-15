/*
  This file has step definitions for the apps list page as well as
  step definitions that are shared between app, workload, and service
  pages since these are all similar.
*/

import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
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

Then('user see no traces', () => {
  openTab('Traces');

  cy.getBySel('tracing-scatterplot').should('not.exist');

  // Ensures traces have loaded.
  cy.getBySel('empty-traces').contains('No trace results');
});

Then('user sees trace details', () => {
  cy.getBySel('trace-details-tabs').should('be.visible');
  cy.getBySel('trace-details-kebab').click();
  cy.getBySel('trace-details-dropdown').contains('View on Graph');
});

When('user selects a trace', () => {
  const tracingDotQuery =
    'var(--pf-t--temp--dev--tbd)'; /* CODEMODS: original v5 color was --pf-v6-global--palette--blue-200 */

  cy.getBySel('tracing-scatterplot').find(`path${tracingDotQuery}`).first().should('be.visible').click({ force: true });
});

When('user selects a trace with at least {int} spans', (spans: number) => {
  cy.getBySel('tracing-scatterplot').within(() => {
    cy.waitForReact();
    cy.getReact('Point')
      .should('have.length.at.least', 1)
      .then(($points: any) => {
        // We want to find a point that has all of the specified number of spans loaded
        // since some of the later assertions look for a certain number of spans.
        // There doesn't seem to be a good way to inject a data-test attribute into individual points
        // on the graph so here we are looking at the react state of the points and then finding one
        // that matches the exact data path.
        const pointWithTraceName = $points.filter(point => point.props?.datum?.trace?.spans.length >= spans)[0];
        const dataPointInGraph = pointWithTraceName.children[0].props.d;
        cy.get(`path[d="${dataPointInGraph}"]`).should('be.visible').click({ force: true });
      });
  });
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
    .should('exist');

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
  cy.visit({ url: '/console/applications?refresh=0' });
});

When('user opens the namespace dropdown', () => {
  cy.intercept(`**/api/namespaces/`).as('getNamespaces');
  cy.get('[data-test="namespace-dropdown"]').click();
});

Then('user sees Health information for Apps', () => {
  getColWithRowText(APP, 'Health')
    .find('span')
    .filter('.pf-v6-c-icon')
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

    cy.get(`a[href*="/namespaces/bookinfo/istio/networking.istio.io/v1/Gateway/bookinfo-gateway"]`).should(
      'be.visible'
    );
  });
});

Then('user only sees the apps with the {string} name', (name: string) => {
  let count: number;

  cy.request({ method: 'GET', url: `/api/clusters/apps` }).should(response => {
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
      .filter('.pf-v6-c-icon')
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
