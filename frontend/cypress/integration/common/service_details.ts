import { And, Given, Then } from 'cypress-cucumber-preprocessor/steps';

const NAMESPACE = 'bookinfo';
const SERVICE = 'productpage';
const tracingDotQuery = '[style*="fill: var(--pf-global--palette--blue-200)"][style*="stroke: transparent"]';

function openTab(tab: string) {
    cy.get('.pf-c-tabs__list').should('be.visible').contains(tab).click();
}

Given('a service in the cluster with a healthy amount of traffic', function () {
    this.targetNamespace = NAMESPACE;
    this.targetService = SERVICE;
});

Then('sd::user sees a list with content {string}', (tab: string) => {
    cy.get('.pf-c-tabs__list').contains(tab);
});

Then('sd::user sees the actions button', () => {
    cy.getBySel('wizard-actions').should('be.visible').click();
    cy.getBySel('wizard-actions').siblings().contains("Request Routing");
});

Then('sd::user sees {string} details information for service {string}', (name: string, version: string) => {
    cy.get('#ServiceDescriptionCard').within(() => {
        cy.get('#pfbadge-S').parent().parent().contains(name); // Service
        cy.get('#pfbadge-A').parent().parent().contains(name); // App
        cy.get('#pfbadge-W').parent().parent().contains(name + '-' + version); // Workload
    });
});

Then('sd::user sees Network card', (name: string) => {
    cy.get('#ServiceNetworkCard').within(() => {
        cy.get('.pf-c-card__body').contains("Service IP");
        cy.get('.pf-c-card__body').contains("Hostnames");
    });
});

Then('sd::user sees Istio Config', (name: string) => {
    cy.get('#IstioConfigCard').within(() => {
        cy.get('#pfbadge-G').should("be.visible");
        cy.get('#pfbadge-VS').should("be.visible");
    });
});

Then('sd::user sees a minigraph', () => {
    cy.getBySel('mini-graph').within(() => {
        cy.get('#cytoscape-graph').should("be.visible");
        cy.get('#cy').should("be.visible");
    });
});

Then('sd::user sees inbound and outbound traffic information', () => {
    openTab('Traffic');
    cy.get('.pf-c-card__body').within(() => {
        cy.contains('Inbound Traffic');
        cy.contains('No Inbound Traffic').should('not.exist');
        cy.contains('Outbound Traffic');
        cy.contains('No Inbound Traffic').should('not.exist');
        cy.get('table.pf-c-table.pf-m-grid-md').should('exist');
        cy.contains('istio-ingressgateway');
    });
});

Then('sd::user sees {string} graph', (graph: string) => {
    openTab('Inbound Metrics');
    cy.get('.pf-l-grid__item').children().children().children().contains(graph);
});

Then('sd::user does not see No data message in the {string} graph', (graph: string) => {
    openTab('Inbound Metrics');
    cy.get('.pf-l-grid__item').children().children().children().contains(graph).should('not.contain', 'No data available');
});

Then('sd::user sees graph with traces information', (graph: string) => {
    openTab('Traces');
    cy.getBySel('jaeger-scatterplot');
    cy.getBySel('trace-details-tabs').should('not.exist');
    cy.getBySel('jaeger-scatterplot').contains('Traces');
    cy.getBySel('jaeger-scatterplot').find(`path${tracingDotQuery}`).first().should('be.visible').click({ force: true });
});

And('sd::user sees trace details after selecting a trace', () => {
    cy.getBySel('trace-details-tabs').should('be.visible').contains("Trace Details");
    cy.getBySel('trace-details-kebab').click().contains('View on Graph');
});

And('sd::user sees table details after selecting a trace', () => {
    cy.getBySel('trace-details-tabs').should('be.visible').contains("Span Details").click();
    cy.get('table').should('be.visible')
      .find('tbody tr')                // ignore thead rows
      .should('have.length.above', 1)  // retries above cy.find() until we have a non head-row
      .eq(1)                           // take 1st  row
      .find('td').eq(4)                // take 5th cell (kebab)
      .click()
    cy.get('ul.pf-c-dropdown__menu').should('be.visible').contains('Inbound Metrics');
});
