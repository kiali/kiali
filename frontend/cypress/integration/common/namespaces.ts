import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { getClusterForSingleCluster, getColWithRowText } from './table';

Then(`user sees the {string} namespace in the namespaces page`, (ns: string) => {
  cy.get('tbody').contains('td[data-label="Namespace"]', ns);
});

Then(`user sees the {string} namespace in cluster {string} in the namespaces page`, (ns: string, cluster: string) => {
  cy.getBySel(`VirtualItem_Cluster${cluster}_${ns}`).should('exist');
});

Then(
  `user does not see the {string} namespace in cluster {string} in the namespaces page`,
  (ns: string, cluster: string) => {
    cy.getBySel(`VirtualItem_Cluster${cluster}_${ns}`).should('not.exist');
  }
);

const normalizeColumn = (column: string): string => {
  // Header title is "Istio config" but cell data-label is "Config".
  if (column === 'Istio config') {
    return 'Config';
  }

  return column;
};

Then('the {string} column on the {string} row is not empty', (column: string, rowText: string) => {
  const normalized = normalizeColumn(column);

  getColWithRowText(rowText, normalized).then($cell => {
    // Some columns can be icon-only (ex: Istio config validation status).
    if (normalized === 'Config') {
      cy.wrap($cell).find('[data-test$="-validation"]').should('exist');
      return;
    }
    expect($cell.text().trim()).to.not.equal('');
  });
});

When('user filters for type {string}', (type: string) => {
  cy.get('button#filter_select_value-toggle').click();
  cy.contains('div#filter_select_value button', type).click();
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
