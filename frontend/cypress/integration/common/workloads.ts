import { And, Given, Then } from 'cypress-cucumber-preprocessor/steps';
import { checkHealthIndicatorInTable, checkHealthStatusInTable } from "./table";

Given('a healthy workload in the cluster', function () {
    this.targetNamespace = 'bookinfo';
    this.targetWorkload = 'productpage-v1';
});

Given('an idle workload in the cluster', function () {
    this.targetNamespace = 'default';
    this.targetWorkload = 'sleep';

    cy.exec('kubectl scale -n default --replicas=0 deployment/sleep');
});

Given('a failing workload in the mesh', function () {
    this.targetNamespace = 'alpha';
    this.targetWorkload = 'v-server';
});

Given('a degraded workload in the mesh', function () {
    this.targetNamespace = 'alpha';
    this.targetWorkload = 'b-client';
});

And('user filters for workload type {string}', (workloadType: string) => {
    cy.get('select[aria-label="filter_select_type"]').parent().within(() => {
      cy.get('button').click();
      cy.get(`button[label="${workloadType}"]`).click();
    });
  });

Then('user sees {string} in workloads table', (workload: string) => {
  cy.get('tbody').within(() => {
    if (workload === 'no workloads') {
      cy.contains('No workloads found');
    } else if (workload === 'workloads') {
      cy.contains('No workloads found').should('not.exist');
    } else {
      cy.contains('td', workload);
    }
  });
});

And('user should only see healthy workloads in workloads table', () => {
    cy.get('tbody').within(() => {
      cy.get('svg[class=icon-healthy]').should('be.visible');
      cy.get('svg[class=icon-unhealthy], svg[class=icon-degraded], svg[class=icon-na]').should('not.exist');
    });
  });

Then('the workload should be listed as {string}', function (healthStatus: string) {
    checkHealthIndicatorInTable(this.targetNamespace, 'Deployment', this.targetWorkload, healthStatus);
});

Then('the health status of the workload should be {string}', function (healthStatus: string) {
    checkHealthStatusInTable(this.targetNamespace, 'Deployment', this.targetWorkload, healthStatus);
});