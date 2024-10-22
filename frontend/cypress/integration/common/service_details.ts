import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { clusterParameterExists } from './navigation';

const openTab = (tab: string): void => {
  cy.get('.pf-v5-c-tabs__list').should('be.visible').contains(tab).click();
};

Then('sd::user sees a list with content {string}', (tab: string) => {
  cy.get('.pf-v5-c-tabs__list').contains(tab);
});

Then('sd::user sees the service actions', () => {
  // In OSSMC, the service actions toggle does not exist. Service actions are integrated in the minigraph menu
  if (Cypress.env('OSSMC')) {
    cy.intercept(`**/api/**/services/**/graph*`).as('serviceMinigraph');
    cy.wait('@serviceMinigraph');

    cy.waitForReact();

    cy.get('button#minigraph-toggle').should('be.visible').click();
  } else {
    cy.get('button[data-test="service-actions-toggle"]').should('be.visible').click();
  }

  cy.getBySel('request_routing').contains('Request Routing');
});

Then('sd::user sees {string} details information for service {string}', (name: string, version: string) => {
  cy.get('#ServiceDescriptionCard').within(() => {
    cy.get('#pfbadge-S').parent().parent().parent().contains(name); // Service
    cy.get('#pfbadge-A').parent().parent().parent().contains(name); // App
    cy.get('#pfbadge-W').parent().parent().parent().contains(`${name}-${version}`); // Workload

    clusterParameterExists(false);
  });
});

Then('sd::user sees Network card', () => {
  cy.get('#ServiceNetworkCard').within(() => {
    cy.get('.pf-v5-c-card__body').contains('Service IP');
    cy.get('.pf-v5-c-card__body').contains('Hostnames');
  });
});

Then('sd::user sees Istio Config', () => {
  cy.get('#IstioConfigCard').within(() => {
    cy.get('#pfbadge-G').should('be.visible');
    cy.get('#pfbadge-VS').should('be.visible');
  });
});

Then('sd::user sees inbound and outbound traffic information', () => {
  openTab('Traffic');

  cy.get('.pf-v5-c-card__body').within(() => {
    cy.contains('Inbound Traffic');
    cy.contains('No Inbound Traffic').should('not.exist');

    cy.contains('Outbound Traffic');
    cy.contains('No Outbound Traffic').should('not.exist');

    cy.get('table.pf-v5-c-table.pf-m-grid-md').should('exist');
    cy.contains('istio-ingressgateway');
  });
});

Then('sd::user sees {string} graph', (graph: string) => {
  openTab('Inbound Metrics');

  cy.get('.pf-v5-l-grid__item').children().children().children().contains(graph);
});

Then('sd::user does not see No data message in the {string} graph', (graph: string) => {
  openTab('Inbound Metrics');

  cy.get('.pf-v5-l-grid__item')
    .children()
    .children()
    .children()
    .contains(graph)
    .should('not.contain', 'No data available');
});

When('user chooses the {string} option', (title: string) => {
  cy.wait('@waitForCall');

  cy.get('#minigraph-toggle').click();

  cy.contains(title).should('be.visible');
  cy.contains(title).click();
});

Then('the graph type is disabled', () => {
  cy.get('button#graph_type_dropdown-toggle').should('be.disabled');
});
