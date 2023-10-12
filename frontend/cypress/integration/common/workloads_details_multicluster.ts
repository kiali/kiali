import { When, And, Then } from '@badeball/cypress-cucumber-preprocessor';

function openTab(tab: string) {
  cy.get('#basic-tabs').should('be.visible').contains(tab).click();
}

Then('user sees workload inbound and outbound traffic information for the remote workload', () => {
  openTab('Traffic');
  cy.contains('Inbound Traffic');
  cy.contains('No Inbound Traffic').should('not.exist');
  cy.contains('No Outbound Traffic').should('not.exist');
});
