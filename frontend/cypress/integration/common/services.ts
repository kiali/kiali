import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import {
  checkHealthIndicatorInTable,
  checkHealthStatusInTable,
  colExists,
  getColWithRowText,
  hasAtLeastOneClass
} from './table';
import { ensureKialiFinishedLoading } from './transition';

Given('a service in the cluster with a healthy amount of traffic', function () {
  this.targetNamespace = 'bookinfo';
  this.targetService = 'productpage';
});

Given('a service in the cluster with no traffic', function () {
  this.targetNamespace = 'sleep';
  this.targetService = 'sleep';
});

Given('a service in the mesh with a failing amount of traffic', function () {
  this.targetNamespace = 'alpha';
  this.targetService = 'w-server';
});

Given('a service in the mesh with a degraded amount of traffic', function () {
  this.targetNamespace = 'alpha';
  this.targetService = 'y-server';
});

Then('the {string} row is visible', (row: string) => {
  cy.get('table').contains('td', row);
});

Then('the health column on the {string} row has a health icon', (row: string) => {
  getColWithRowText(row, 'Health')
    .find('span')
    .filter('.pf-v5-c-icon')
    .should('satisfy', hasAtLeastOneClass(['icon-healthy', 'icon-unhealthy', 'icon-degraded', 'icon-na']));
});

When('user filters for service type {string}', (serviceType: string) => {
  cy.get('select[aria-label="filter_select_type"]')
    .parent()
    .parent()
    .within(() => {
      cy.get('button').click();
      cy.get(`li[label="${serviceType}"]`).find('button').click();
    });
});

When('user filters for sidecar {string}', (sidecarState: string) => {
  cy.get('select[aria-label="filter_select_value"]').select(sidecarState);
});

When('user filters for health {string}', (health: string) => {
  cy.get('select[aria-label="filter_select_value"]').select(health);
});

Then('user should only see healthy services in the table', () => {
  cy.get('tbody').within(() => {
    cy.get('span[class*="icon-healthy"]').should('be.visible');
    cy.get('span[class*="icon-unhealthy"],span[class*="icon-degraded"],span[class*="icon-na"]').should('not.exist');
  });
});

When('user filters for label {string}', (label: string) => {
  cy.get('input[aria-label="filter_input_label_key"]').type(`${label}{enter}`);
});

When('user applies kiali api {string} annotations', (type: string) => {
  cy.exec(`kubectl annotate service productpage -n bookinfo kiali.io/api-type=${type} --overwrite`, {
    failOnNonZeroExit: false
  });
  cy.exec(
    'kubectl annotate service productpage -n bookinfo kiali.io/api-spec=https://petstore.swagger.io/v2/swagger.json',
    { failOnNonZeroExit: false }
  );
});

Then('the service should be listed as {string}', function (healthStatus: string) {
  checkHealthIndicatorInTable(this.targetNamespace, null, this.targetService, healthStatus);
});

Then('the health status of the service should be {string}', function (healthStatus: string) {
  checkHealthStatusInTable(this.targetNamespace, null, this.targetService, healthStatus);
});

When('user clicks {string} label', (label: string) => {
  cy.get('tbody').within(() => {
    cy.get('span').contains(label).click();
  });

  ensureKialiFinishedLoading();
});

Then('user sees all the Services toggles', () => {
  cy.get('[data-test="toggle-configuration"]').should('be.checked');
  cy.get('[data-test="toggle-health"]').should('be.checked');
  cy.get('[data-test="toggle-istioResources"]').should('be.checked');

  colExists('Configuration', true);
  colExists('Health', true);
  colExists('Details', true);
});
