import { And, Given, Then, When } from 'cypress-cucumber-preprocessor/steps';
import {checkHealthIndicatorInTable, checkHealthStatusInTable, getCellsForCol, getColWithRowText} from './table';
import { ensureKialiFinishedLoading } from './transition';

const NAMESPACE = 'bookinfo';
const SERVICE = 'productpage';
const URL = '/console/namespaces/'+NAMESPACE+'/services/'+SERVICE+'?refresh=0';
const tracingDotQuery = '[style*="fill: var(--pf-global--palette--blue-200)"][style*="stroke: transparent"]';

function openTab(tab: string) {
    cy.get('.pf-c-tabs__list').should('be.visible').contains(tab).click();
}

Given('a service in the cluster with a healthy amount of traffic', function () {
    this.targetNamespace = NAMESPACE;
    this.targetService = SERVICE;
});

Then('user sees a list with content {string}', (tab: string) => {
    cy.get('.pf-c-tabs__list').contains(tab);
});

Then('user sees the actions button', () => {
    cy.getBySel('wizard-actions').should('be.visible').click();
    cy.getBySel('wizard-actions').siblings().contains("Request Routing");
});

Then('user sees {string} details information for service {string}', (name: string, version: string) => {
    cy.get('#ServiceDescriptionCard').within(() => {
        cy.get('#pfbadge-S').parent().parent().contains(name); // Service
        cy.get('#pfbadge-A').parent().parent().contains(name); // App
        cy.get('#pfbadge-W').parent().parent().contains(name + '-' + version); // Workload
    });
});

Then('user sees Network card', (name: string) => {
    cy.get('#ServiceNetworkCard').within(() => {
        cy.get('.pf-c-card__body').contains("Service IP");
        cy.get('.pf-c-card__body').contains("Hostnames");
    });
});

Then('user sees Istio Config', (name: string) => {
    cy.get('#IstioConfigCard').within(() => {
        cy.get('#pfbadge-G').should("be.visible");
        cy.get('#pfbadge-VS').should("be.visible");
    });
});

Then('user sees a minigraph', () => {
    cy.getBySel('mini-graph').within(() => {
        cy.get('#cytoscape-graph').should("be.visible");
        cy.get('#cy').should("be.visible");
    });
});

Then('user sees inbound and outbound traffic information', () => {
    openTab('Traffic');
    cy.contains('Inbound Traffic');
    cy.contains('No Inbound Traffic').should('not.exist');
    cy.contains('Outbound Traffic');
    cy.contains('No Inbound Traffic').should('not.exist');
    cy.contains('.pf-c-card__body').within(() => {
        cy.get('table.pf-c-table.pf-m-grid-md').should('exist');
        cy.contains('istio-ingressgateway');
    });
});

Then('the user sees {string} graph', (graph: string) => {
    openTab('Inbound Metrics');
    cy.get('.pf-l-grid__item').children().children().children().contains(graph);
});

Then('the user does not see No data message in the {string} graph', (graph: string) => {
    openTab('Inbound Metrics');
    cy.get('.pf-l-grid__item').children().children().children().contains(graph).should('not.contain', 'No data available');
});

Then('user sees graph with traces information', (graph: string) => {
    openTab('Traces');
    cy.getBySel('jaeger-scatterplot');
});

And('And user sees trace details after selecting a trace', () => {
    cy.getBySel('trace-details-tabs').should('not.exist');
    cy.getBySel('jaeger-scatterplot').contains('Traces');
    cy.getBySel('jaeger-scatterplot').find(`path${tracingDotQuery}`).first().should('be.visible').click({ force: true });
    cy.getBySel('trace-details-tabs').should('be.visible').contains("Trace Details");
    cy.getBySel('.pf-l-grid').should('be.visible').get(".pf-c-label__content").should('be.visible');
    cy.getBySel('trace-details-kebab').click().contains('View on Graph');
});

And('user sees table details after selecting a trace', () => {
    cy.getBySel('trace-details-tabs').should('not.exist');
    cy.getBySel('jaeger-scatterplot').contains('Traces');
    cy.getBySel('jaeger-scatterplot').find(`path${tracingDotQuery}`).first().should('be.visible').click({ force: true });
    cy.getBySel('trace-details-tabs').should('be.visible').contains("Span Details").click();
    cy.get('table').should('be.visible').contains('th', 'Timeline');
    cy.get('#pf-tab-section-1-trace-details').within(() => {
        cy.get('.pf-c-dropdown__toggle.pf-m-plain').first().click();
        cy.get('ul.pf-c-dropdown__menu').should('be.visible').contains('Inbound Metrics');
    });
});
