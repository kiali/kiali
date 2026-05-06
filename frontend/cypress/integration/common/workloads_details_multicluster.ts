import { Then } from '@badeball/cypress-cucumber-preprocessor';
import { clusterParameterExists } from './navigation';
import { openTab } from './transition';

Then('user sees details information for a remote workload', () => {
  cy.getBySel('workload-resources-card').within(() => {
    cy.get('#pfbadge-A').closest('li').contains('reviews'); // App
    cy.get('#pfbadge-S').closest('li').contains('reviews'); // Service
  });

  cy.getBySel('workload-resources-card').within(() => {
    clusterParameterExists(true);
  });
});

Then('user sees workload inbound and outbound traffic information for the remote workload', () => {
  openTab('Traffic');

  cy.contains('Inbound Traffic');
  cy.contains('No Inbound Traffic').should('not.exist');
  cy.contains('No Outbound Traffic').should('not.exist');
});

Then('the envoy tab should not be visible', () => {
  cy.get('#basic-tabs').contains('Envoy').should('not.exist');
});
