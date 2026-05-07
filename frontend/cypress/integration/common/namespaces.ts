import { Then, When, TableDefinition } from '@badeball/cypress-cucumber-preprocessor';
import { colExists, getClusterForSingleCluster, getColWithRowText } from './table';

Then(`user sees the {string} namespace in the namespaces page`, (ns: string) => {
  cy.get('tbody').contains('td[data-label="Namespace"]', ns);
});

When('user clicks the namespace detail link for {string}', (ns: string) => {
  cy.get('tbody').contains('td[data-label="Namespace"]', ns).find('a').filter(`:contains("${ns}")`).first().click();
});

Then('user is on the namespace detail page for {string}', (ns: string) => {
  cy.url().should('include', `/namespaces/${ns}`);
  cy.get(`[data-test="namespace-detail-overview-${ns}"]`).should('exist');
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

When('user opens manage columns on namespaces page', () => {
  cy.getBySel('namespaces-manage-columns').click();
});

When('user unchecks column {string} in manage columns', (columnTitle: string) => {
  const id = columnTitleToId(columnTitle);
  cy.get(`[data-testid="column-check-${id}"]`).uncheck();
});

When('user saves manage columns', () => {
  cy.get('[data-ouia-component-id="ColumnManagementModal-save-button"]').click();
});

When('user resets columns to default on namespaces page', () => {
  cy.getBySel('namespaces-manage-columns').click();
  cy.get('[data-ouia-component-id="ColumnManagementModal-reset-button"]').click();
  cy.get('[data-ouia-component-id="ColumnManagementModal-save-button"]').click();
});

/** Map display title to stable column id (Config column.id or name). */
const columnTitleToId = (title: string): string => {
  const map: Record<string, string> = {
    'Istio config': 'istioconfiguration'
  };
  return map[title] ?? title.toLowerCase();
};

/** Set column order via URL param nsorder. Ensures the table applies that order. */
When('user sets namespaces column order via URL to', (tableHeadings: TableDefinition) => {
  const columnTitles = tableHeadings.raw()[0] as string[];
  const orderParam = columnTitles.map(t => columnTitleToId(t)).join(',');
  cy.url().then(url => {
    const u = new URL(url);
    u.searchParams.set('nsorder', orderParam);
    cy.visit(u.toString());
  });
});

Then('the table column order on namespaces page is', (tableHeadings: TableDefinition) => {
  const expectedOrder = tableHeadings.raw()[0] as string[];
  // Wait for column management modal to close so we target the main table
  cy.get('[data-ouia-component-id="ColumnManagementModal"]').should('not.exist');
  // Get visible column headers (filter out empty header for actions column)
  cy.get('table thead th').then($ths => {
    const actualOrder = $ths
      .toArray()
      .map(th => th.getAttribute('data-label'))
      .filter((label): label is string => label !== null && label !== '');
    expect(actualOrder).to.deep.equal(expectedOrder);
  });
});

Then('the {string} column {string} on namespaces page', (col: string, action: 'appears' | 'disappears') => {
  colExists(col, action === 'appears');
});
