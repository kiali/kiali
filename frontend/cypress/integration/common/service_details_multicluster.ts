import { Then } from '@badeball/cypress-cucumber-preprocessor';

const openTab = (tab: string): void => {
  cy.get('.pf-v6-c-tabs__list').should('be.visible').contains(tab).click();
};

Then('sd::user sees {string} details information for the remote service {string}', (name: string, version: string) => {
  cy.getBySel('service-resources-card').within(() => {
    cy.get('#pfbadge-A').parent().parent().parent().contains(name); // App
    cy.get('#pfbadge-W').parent().parent().parent().contains(`${name}-${version}`); // Workload
  });
});

Then('sd::user sees inbound and outbound traffic information for the remote service', () => {
  openTab('Traffic');

  cy.get('.pf-v6-c-card__body').within(() => {
    cy.contains('Inbound Traffic');
    cy.contains('No Inbound Traffic').should('not.exist');
    cy.contains('Outbound Traffic');
    cy.contains('No Inbound Traffic').should('not.exist');
    cy.get('table.pf-v6-c-table.pf-m-grid-md').should('exist');
  });
});

const descriptionTypeToResourcesSelector = (type: string): string => {
  switch (type) {
    case 'Service':
      return 'service-resources-card';
    case 'Workload':
      return 'workload-resources-card';
    case 'App':
      return 'app-resources-card';
    default:
      return `${type.toLowerCase()}-resources-card`;
  }
};

const descriptionTypeToDetailsSelector = (type: string): string => {
  switch (type) {
    case 'Service':
      return 'service-details-card';
    case 'Workload':
      return 'workload-details-card';
    case 'App':
      return 'app-details-card';
    default:
      return `${type.toLowerCase()}-details-card`;
  }
};

Then(
  'links in the {string} description card should contain a reference to a {string} cluster',
  (type: string, cluster: string) => {
    cy.getBySel(descriptionTypeToResourcesSelector(type)).within(() => {
      cy.get('a').each($el => {
        cy.wrap($el).should('have.attr', 'href').and('include', `clusterName=${cluster}`);
      });
    });
  }
);

Then(
  'cluster badge for {string} cluster should be visible in the {string} description card',
  (cluster: string, type: string) => {
    cy.getBySel(descriptionTypeToDetailsSelector(type)).contains(cluster);
  }
);
