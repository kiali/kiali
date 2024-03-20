import { Then, When } from '@badeball/cypress-cucumber-preprocessor';

function openTab(tab: string) {
  cy.get('.pf-c-tabs__list').should('be.visible').contains(tab).click();
}

Then('sd::user sees a list with content {string}', (tab: string) => {
  cy.get('.pf-c-tabs__list').contains(tab);
});

Then('sd::user sees the actions button', () => {
  cy.getBySel('wizard-actions').should('be.visible').click();
  cy.getBySel('wizard-actions').siblings().contains('Request Routing');
});

Then('sd::user sees {string} details information for service {string}', (name: string, version: string) => {
  cy.get('#ServiceDescriptionCard').within(() => {
    cy.get('#pfbadge-S').parent().parent().contains(name); // Service
    cy.get('#pfbadge-A').parent().parent().contains(name); // App
    cy.get('#pfbadge-W')
      .parent()
      .parent()
      .contains(name + '-' + version); // Workload
  });
});

Then('sd::user sees Network card', (name: string) => {
  cy.get('#ServiceNetworkCard').within(() => {
    cy.get('.pf-c-card__body').contains('Service IP');
    cy.get('.pf-c-card__body').contains('Hostnames');
  });
});

Then('sd::user sees Istio Config', (name: string) => {
  cy.get('#IstioConfigCard').within(() => {
    cy.get('#pfbadge-G').should('be.visible');
    cy.get('#pfbadge-VS').should('be.visible');
  });
});

Then('sd::user sees a minigraph', () => {
  cy.getBySel('mini-graph').within(() => {
    cy.get('#cytoscape-graph').should('be.visible');
    cy.get('#cy').should('be.visible');
  });
});

Then('sd::user sees inbound and outbound traffic information', () => {
  openTab('Traffic');
  cy.get('.pf-c-card__body').within(() => {
    cy.contains('Inbound Traffic');
    cy.contains('No Inbound Traffic').should('not.exist');

    cy.contains('Outbound Traffic');
    cy.contains('No Outbound Traffic').should('not.exist');

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
  cy.get('.pf-l-grid__item')
    .children()
    .children()
    .children()
    .contains(graph)
    .should('not.contain', 'No data available');
});

When('user chooses the {string} option', (title: string) => {
  cy.wait('@waitForCall');
  cy.get('button[aria-label="Actions"]').click();
  cy.contains(title).should('be.visible');
  cy.contains(title).click();
});

Then('the graph type is disabled', () => {
  cy.get('button[aria-label="Options menu"]').should('be.disabled');
});
