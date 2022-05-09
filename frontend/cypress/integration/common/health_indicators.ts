import { Given, Then, When } from "cypress-cucumber-preprocessor/steps";

Given('a healthy application in the cluster', function () {
    this.targetNamespace = 'bookinfo';
    this.targetApp = 'productpage';
})

Given('an idle application in the cluster', function () {
    this.targetNamespace = 'default';
    this.targetApp = 'sleep';

    cy.exec('kubectl scale -n default --replicas=0 deployment/sleep');
});

Given('a failing application in the mesh', function () {
    this.targetNamespace = 'alpha';
    this.targetApp = 'v-server';
});

Given('a degraded application in the mesh', function () {
    this.targetNamespace = 'alpha';
    this.targetApp = 'b-client';
});

When('I fetch the list of applications', function () {
    cy.visit('/console/applications?refresh=0');
});

When('I fetch the overview of the cluster', function () {
    cy.visit('/console/overview?refresh=0');
});

Then('the application should be listed as {string}', function (healthStatus: string) {
    cy.get(`[data-test=VirtualItem_Ns${this.targetNamespace}_${this.targetApp}] svg[class=icon-${healthStatus}]`)
        .should('exist');
});

Then('the health status of the application should be {string}', function (healthStatus: string) {
    cy.get(`[data-test=VirtualItem_Ns${this.targetNamespace}_${this.targetApp}] td:first-child span`)
        .trigger('mouseenter');
    cy.get(`[aria-label='Health indicator'] strong`)
        .should('contain.text', healthStatus);
});

Then('there should be a {string} application indicator in the namespace', function (healthStatus: string) {
    cy.get(`[data-test=${this.targetNamespace}-EXPAND] [data-test=overview-app-health] svg[class=icon-${healthStatus}]`)
        .should('exist');
});

Then('the {string} application indicator should list the application', function (healthStatus: string) {
    let healthIndicatorStatusKey = healthStatus;
    if (healthStatus === 'idle') {
        healthIndicatorStatusKey = 'not-ready';
    }

    cy.get(`[data-test=${this.targetNamespace}-EXPAND] [data-test=overview-app-health] svg[class=icon-${healthStatus}]`)
        .trigger('mouseenter');
    cy.get(`[aria-label='Overview status'][class=health_indicator] [data-test=${this.targetNamespace}-${healthIndicatorStatusKey}-${this.targetApp}] svg[class=icon-${healthStatus}]`)
        .should('exist');
    cy.get(`[aria-label='Overview status'][class=health_indicator] [data-test=${this.targetNamespace}-${healthIndicatorStatusKey}-${this.targetApp}]`)
        .should('contain.text', this.targetApp);
});
