import { And, Given, Then, When } from 'cypress-cucumber-preprocessor/steps';
import {checkHealthIndicatorInTable, checkHealthStatusInTable, getCellsForCol, getColWithRowText} from './table';
import { ensureKialiFinishedLoading } from './transition';

const NAMESPACE = 'bookinfo';
const SERVICE = 'productpage';
const URL = '/console/namespaces/'+NAMESPACE+'/services/'+SERVICE+'?refresh=0';

Given('a service in the cluster with a healthy amount of traffic', function () {
    this.targetNamespace = NAMESPACE;
    this.targetService = SERVICE;
});

Then('user sees a list with content {string}', (tab: string) => {
    cy.get('.pf-c-tabs__list').contains(tab);
});

Then('user sees productpage details information for service', () => {
    cy.get('#ServiceDescriptionCard').within(() => {
        cy.get('#pfbadge-S').parent().parent().contains('productpage'); // Service
        cy.get('#pfbadge-A').parent().parent().contains('productpage'); // App
        cy.get('#pfbadge-W').parent().parent().contains('productpage-v1'); // Workload
    });
});

Then('user sees a minigraph', () => {
    cy.getBySel('mini-graph');
});

function openTab(tab: string) {
    cy.get('.pf-c-tabs__list').should('be.visible').contains(tab).click();
}

Then('user sees inbound and outbound traffic information', () => {
    openTab('Traffic');
    cy.contains('Inbound Traffic');
    cy.contains('No Inbound Traffic').should('not.exist');
    cy.contains('Outbound Traffic');
    cy.contains('No Inbound Traffic').should('not.exist');
});

Then('the user sees {string} graph', (graph: string) => {
    openTab('Inbound Metrics');
    cy.get('.pf-l-grid__item').children().children().children().contains(graph);
});

Then('the user does not see No data message in the {string} graph', (graph: string) => {
    openTab('Inbound Metrics');
    cy.get('.pf-l-grid__item').children().children().children().contains(graph).should('not.contain', 'No data available');
});

