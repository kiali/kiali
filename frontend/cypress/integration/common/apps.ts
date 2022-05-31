import { And, Then, When } from 'cypress-cucumber-preprocessor/steps';
import { getColWithRowText, ensureObjectsInTable, checkHealthIndicatorInTable, checkHealthStatusInTable } from './table';

// Choosing a random bookinfo app to test with.
const APP = 'details';

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
