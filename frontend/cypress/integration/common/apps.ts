/*
  This file has step definitions for the apps list page as well as
  step definitions that are shared between app, workload, and service
  pages since these are all similar.
*/

import { And, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import {
  getColWithRowText,
  ensureObjectsInTable,
  checkHealthIndicatorInTable,
  checkHealthStatusInTable
} from './table';
import { openTab } from './transition';

// Choosing a random bookinfo app to test with.
const APP = 'details';

Then('user sees trace information', () => {
  openTab('Traces');
  cy.getBySel('jaeger-scatterplot');
  // Ensures a trace hasn't been clicked on yet.
  cy.getBySel('trace-details-tabs').should('not.exist');
  // Ensures traces have loaded.
  cy.getBySel('jaeger-scatterplot').contains('Traces');
});

Then('user sees trace details', () => {
  cy.getBySel('trace-details-tabs').should('be.visible');
  cy.getBySel('trace-details-kebab').click().contains('View on Graph');
});

When('user selects a trace', () => {
  const tracingDotQuery = '[style*="fill: var(--pf-global--palette--blue-200)"][style*="stroke: transparent;"]';
  cy.getBySel('jaeger-scatterplot').find(`path${tracingDotQuery}`).first().should('be.visible').click({ force: true });
});

And('user sees span details', () => {
  cy.getBySel('trace-details-tabs').should('be.visible').contains('Span Details').click({ scrollBehavior: false });
  cy.get('table')
    .should('be.visible')
    .find('tbody tr') // ignore thead rows
    .should('have.length.above', 1) // retries above cy.find() until we have a non head-row
    .eq(1) // take 1st  row
    .find('td')
    .eq(4) // take 5th cell (kebab)
    .should('be.visible')
});

When('I fetch the list of applications', function () {
  cy.visit('/console/applications?refresh=0');
});

And('user sees Health information for Apps', () => {
  getColWithRowText(APP, 'Health').find(
    'svg[class=icon-healthy], svg[class=icon-unhealthy], svg[class=icon-degraded], svg[class=icon-na]'
  );
});

Then('user sees all the Apps in the bookinfo namespace', () => {
  ensureObjectsInTable('details', 'kiali-traffic-generator', 'productpage', 'ratings', 'reviews');
});

And('user sees Name information for Apps', () => {
  // There should be a table with a heading for each piece of information.
  getColWithRowText(APP, 'Name').within(() => {
    cy.get(`a[href*="/namespaces/bookinfo/applications/${APP}"]`).should('be.visible');
  });
});

And('user sees Namespace information for Apps', () => {
  getColWithRowText(APP, 'Namespace').contains('bookinfo');
});

And('user sees Labels information for Apps', () => {
  getColWithRowText(APP, 'Labels').contains('app=details');
  getColWithRowText(APP, 'Labels').contains('service=details');
  getColWithRowText(APP, 'Labels').contains('version=v1');
});

And('user sees Details information for Apps', () => {
  getColWithRowText(APP, 'Details').within(() => {
    cy.contains('bookinfo-gateway');
    cy.get(`a[href*="/namespaces/bookinfo/istio/gateways/bookinfo-gateway"]`).should('be.visible');
  });
});

Then('user only sees {int} apps', (sees: number) => {
  cy.get('tbody').within(() => {
    cy.contains('No apps found').should('not.exist');
    cy.get('tr').should('have.length', sees);
  });
});

// This is somewhat vague because there's no guarantee that all the bookinfo apps are
// going to be healthy when the test is run but at least some of them should be.
Then('user only sees healthy apps', () => {
  cy.get('tbody').within(() => {
    cy.get('tr').find('svg[class=icon-healthy]');
  });
});

Then('the application should be listed as {string}', function (healthStatus: string) {
  checkHealthIndicatorInTable(this.targetNamespace, null, this.targetApp, healthStatus);
});

Then('the health status of the application should be {string}', function (healthStatus: string) {
  checkHealthStatusInTable(this.targetNamespace, null, this.targetApp, healthStatus);
});

Then('user cannot see any apps in the table', () => {
  cy.get('h5').contains('No applications found').should('exist');
});
