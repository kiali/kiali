import { And, Then, But } from '@badeball/cypress-cucumber-preprocessor';
import { getCellsForCol } from './table';
import { openTab } from './transition';
import { clusterParameterExists } from './navigation';

Then('user sees details information for the remote {string} app', (name: string) => {
  cy.getBySel('app-description-card').within(() => {
    cy.get('#pfbadge-A').parent().parent().parent().contains(name)// App
    cy.get('#pfbadge-W').parent().parent().parent().contains(`${name}-v1`); // Workload
    cy.get('#pfbadge-S').parent().parent().parent().contains(name); // Service
    clusterParameterExists(true);
  });
});
