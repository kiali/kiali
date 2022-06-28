import { And, Given, Then, When } from 'cypress-cucumber-preprocessor/steps';
import { checkHealthIndicatorInTable, checkHealthStatusInTable, getColWithRowText } from './table';
import { ensureKialiFinishedLoading } from './transition';

Given('a service in the cluster with a healthy amount of traffic', function () {
  this.targetNamespace = 'bookinfo';
  this.targetService = 'productpage';
});

Given('a service in the cluster with no traffic', function () {
  this.targetNamespace = 'default';
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

And('the {string} row is visible', (row: string) => {
  cy.get('table').contains('td', row);
});

And('the health column on the {string} row has a health icon', (row: string) => {
  getColWithRowText(row, 'Health').find(
    'svg[class=icon-healthy], svg[class=icon-unhealthy], svg[class=icon-degraded], svg[class=icon-na]'
  );
});

And('user filters for service type {string}', (serviceType: string) => {
  cy.get('select[aria-label="filter_select_type"]')
    .parent()
    .within(() => {
      cy.get('button').click();
      cy.get('button[label="External"]').click();
    });
});

And('user filters for sidecar {string}', (sidecarState: string) => {
  cy.get('select[aria-label="filter_select_value"]').select(sidecarState);
});

And('user filters for health {string}', (health: string) => {
  cy.get('select[aria-label="filter_select_value"]').select(health);
});

And('user should only see healthy services in the table', () => {
  cy.get('tbody').within(() => {
    cy.get('svg[class=icon-healthy]').should('be.visible');
    cy.get('svg[class=icon-unhealthy], svg[class=icon-degraded], svg[class=icon-na]').should('not.exist');
  });
});

When('user filters for label {string}', (label: string) => {
  cy.get('input[aria-label="filter_input_label_key"]').type(`${label}{enter}`);
});

Then('the service should be listed as {string}', function (healthStatus: string) {
  checkHealthIndicatorInTable(this.targetNamespace, null, this.targetService, healthStatus);
});

Then('the health status of the service should be {string}', function (healthStatus: string) {
  checkHealthStatusInTable(this.targetNamespace, null, this.targetService, healthStatus);
});

And('user clicks {string} label', (label: string) => {
  cy.get('tbody').within(() => {
    cy.get('span').contains(label).click();
  });
  ensureKialiFinishedLoading();
});
