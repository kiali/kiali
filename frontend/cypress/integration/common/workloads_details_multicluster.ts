import { Then } from '@badeball/cypress-cucumber-preprocessor';
import { clusterParameterExists } from './navigation';

const openTab = (tab: string): void => {
  cy.get('#basic-tabs').should('be.visible').contains(tab).click();
};

Then('user sees details information for a remote workload', () => {
  cy.getBySel('workload-description-card').within(() => {
    cy.get('#pfbadge-A').parent().parent().parent().contains('reviews'); // App
    cy.get('#pfbadge-W').parent().parent().parent().contains('reviews-v2'); // Workload
    cy.get('#pfbadge-S').parent().parent().parent().contains('reviews'); // Service

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
