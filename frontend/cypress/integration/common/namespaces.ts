import { Then } from '@badeball/cypress-cucumber-preprocessor';
import { getClusterForSingleCluster } from './table';

// Namespace page (table) helpers.

Then(`user sees the {string} namespace in the namespaces page`, (ns: string) => {
  cy.get('tbody').contains('td', ns);
});

Then(
  'cluster badges for {string} and {string} cluster are visible in the namespaces page',
  (cluster1: string, cluster2: string) => {
    cy.getBySel(`VirtualItem_Cluster${cluster1}_bookinfo`).contains(cluster1).should('be.visible');
    cy.getBySel(`VirtualItem_Cluster${cluster2}_bookinfo`).contains(cluster2).should('be.visible');
  }
);

Then('badge for {string} is visible in the namespaces page in the namespace {string}', (label: string, ns: string) => {
  getClusterForSingleCluster().then(cluster => {
    cy.getBySel(`VirtualItem_Cluster${cluster}_${ns}`).contains(label).should('be.visible');
  });
});
