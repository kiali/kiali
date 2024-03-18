import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { TableDefinition } from 'cypress-cucumber-preprocessor';

enum SortOrder {
  Ascending = 'ascending',
  Descending = 'descending'
}

Then(`user sees a table with headings`, (tableHeadings: TableDefinition) => {
  const headings = tableHeadings.raw()[0];

  cy.get('table');

  headings.forEach(heading => {
    cy.get(`th[data-label="${heading}"]`);
  });
});

Then(
  'the {string} column on the {string} row has a link ending in {string}',
  (column: string, rowText: string, link: string) => {
    getColWithRowText(rowText, column).within(() => {
      // $= is endswith since console link can change depending on the deployment.
      cy.get(`a[href$="${link}"]`).should('be.visible');
    });
  }
);

Then(
  'the {string} column on the {string} row has a icon with title {string}',
  (column: string, rowText: string, title: string) => {
    getColWithRowText(rowText, column).within(() => {
      cy.get(`img[title="${title}"]`).should('be.visible');
    });
  }
);

Then(
  'the {string} column on the {string} row has the text {string}',
  (column: string, rowText: string, text: string) => {
    getColWithRowText(rowText, column).contains(text);
  }
);

Then('the {string} column on the {string} row is empty', (column: string, rowText: string, text: string) => {
  getColWithRowText(rowText, column).children().should('be.empty');
});

When('user clicks in {string} column on the {string} text', (column: string, rowText: string) => {
  getColWithRowText(rowText, column).find('a').click();
});

Then('user sees {string} in the table', (service: string) => {
  cy.get('tbody').within(() => {
    if (service === 'nothing') {
      cy.contains('No services found');
    } else if (service === 'something') {
      cy.contains('No services found').should('not.exist');
    } else {
      cy.contains('td', service);
    }
  });
});

Then('table length should be {int}', (numRows: number) => {
  cy.get('tbody').within(() => {
    cy.get('tr').should('have.length', numRows);
  });
});

Then('table length should exceed {int}', (numRows: number) => {
  cy.get('tbody').within(() => {
    cy.get('tr').should('have.length.greaterThan', numRows);
  });
});

When('user selects filter {string}', (filter: string) => {
  cy.get('button#filter_select_type-toggle').click();
  // Use regexp to match exact filter text
  cy.contains('div#filter_select_type button', new RegExp(`^${filter}$`)).click();
});

When('user filters for name {string}', (name: string) => {
  cy.get('input#filter_input_value').type(`${name}{enter}`);
});

When('user filters for istio config type {string}', (istioType: string) => {
  cy.get('input[placeholder="Filter by Istio Config Type"]').type(`${istioType}{enter}`);

  cy.get(`li[label="${istioType}"]`).should('be.visible').find('button').click();
});

// checkCol
// This func assumes:
//
// 1. There is only 1 table on the screen.
//
// Be aware of these assumptions when using this func.
export const colExists = (colName: string, exists: boolean): Cypress.Chainable => {
  return cy.get(`th[data-label="${colName}"]`).should(exists ? 'exist' : 'not.exist');
};

// hasAtLeastOneClass will check if the element has that class/classes.
// This func makes a couple assumptions:
//
// 1. The classes expected
export const hasAtLeastOneClass = (expectedClasses: string[]): (($el: HTMLElement[]) => boolean) => {
  return ($el: HTMLElement[]) => {
    const classList = Array.from($el[0].classList);
    return expectedClasses.some((expectedClass: string) => classList.includes(expectedClass));
  };
};

// getColWithRowText will find the column matching the unique row text and column header name.
// This func makes a couple assumptions:
//
// 1. The text to search for is unique in the row.
// 2. There is only 1 table on the screen.
//
// Be aware of these assumptions when using this func.
export const getColWithRowText = (rowSearchText: string, colName: string): Cypress.Chainable => {
  return cy.get('tbody').contains('tr', rowSearchText).find(`td[data-label="${colName}"]`);
};

// getCellsForCol returns every cell matching the table header name or
// the table header index. Example:
//
// | Name | Type | Health |
// | app1 | wkld | Good   |
// | app2 | svc  | Good   |
//
// getCellsForCol('Name') or getCellsForCol(0) would both return
// the cells 'app1' and 'app2'.
export const getCellsForCol = (column: string | Number): Cypress.Chainable => {
  if (typeof column === 'number') {
    return cy.get('td').eq(column);
  }

  return cy.get(`td[data-label="${column}"]`);
};

Then('user sees the {string} table with {int} rows', (tableName: string, numRows: number) => {
  let tableId = '';

  switch (tableName) {
    case 'Istio Config':
      tableId = 'Istio Config List';
      break;
  }

  cy.get(`table[aria-label="${tableId}"]`).within(() => {
    cy.get('tbody').within(() => {
      cy.get('tr').should('have.length', numRows);
    });
  });
});

// Note that we can't count the rows on this case, as empty tables add a row with the message
Then('user sees the {string} table with empty message', (tableName: string) => {
  let tableId = '';

  switch (tableName) {
    case 'Istio Config':
      tableId = 'Istio Config List';
      break;
  }

  cy.get(`table[aria-label="${tableId}"]`).within(() => {
    cy.get('[data-test="istio-config-empty"]');
  });
});

When(
  'user clicks in the {string} table {string} badge {string} name row link',
  (tableName: string, badge: string, name: string) => {
    let tableId = '';

    switch (tableName) {
      case 'Istio Config':
        tableId = 'Istio Config List';
        break;
    }

    cy.get(`table[aria-label="${tableId}"]`).within(() => {
      cy.contains('div', badge).siblings().first().click();
    });
  }
);

// ensureObjectsInTable name can represent apps, istio config, objects, services etc.
export const ensureObjectsInTable = (...names: string[]): void => {
  cy.get('tbody').within(() => {
    cy.get('tr').should('have.length.at.least', names.length);

    names.forEach(name => {
      cy.get('tr').contains(name);
    });
  });
};

// Only works for a single cluster.
export const checkHealthIndicatorInTable = (
  targetNamespace: string,
  targetType: string | null,
  targetRowItemName: string,
  healthStatus: string
): void => {
  const selector = targetType
    ? `${targetNamespace}_${targetType}_${targetRowItemName}`
    : `${targetNamespace}_${targetRowItemName}`;

  // cy.getBySel(`VirtualItem_Ns${selector}]`).find('span').filter(`.icon-${healthStatus}`).should('exist');
  // Fetch the cluster info from /api/clusters
  // TODO: Move this somewhere else since other tests will most likely need this info as well.
  // VirtualItem_Clustercluster-default_Nsbookinfo_details
  // VirtualItem_Clustercluster-default_Nsbookinfo_productpage
  cy.request('/api/clusters').then(response => {
    cy.wrap(response.isOkStatusCode).should('be.true');
    cy.wrap(response.body).should('have.length', 1);

    const cluster = response.body[0].name;

    cy.getBySel(`VirtualItem_Cluster${cluster}_Ns${selector}`)
      .find('span')
      .filter(`.icon-${healthStatus}`)
      .should('exist');
  });
};

export const checkHealthStatusInTable = (
  targetNamespace: string,
  targetType: string | null,
  targetRowItemName: string,
  healthStatus: string
): void => {
  const selector = targetType
    ? `${targetNamespace}_${targetType}_${targetRowItemName}`
    : `${targetNamespace}_${targetRowItemName}`;

  cy.request('/api/clusters').then(response => {
    cy.wrap(response.isOkStatusCode).should('be.true');
    cy.wrap(response.body).should('have.length', 1);

    const cluster = response.body[0].name;

    cy.get(
      `[data-test=VirtualItem_Cluster${cluster}_Ns${selector}] td:first-child span[class=pf-v5-c-icon__content]`
    ).trigger('mouseenter');

    cy.get(`[aria-label='Health indicator'] strong`).should('contain.text', healthStatus);
  });
};

// Find all the rows that contain a column with the content.
export const findAllRowsMatchingColumn = (columnName: string, content: string): Cypress.Chainable => {
  return cy.get('tbody').find(`td[data-label="${columnName}"]`).filter(`:contains(${content})`).parent();
};

Then('configuration in both clusters for the {string} namespace should be healthy', (namespace: string) => {
  findAllRowsMatchingColumn('Namespace', namespace).then($rows => {
    // Ensure there's at least one row from each cluster
    cy.wrap($rows).find('td[data-label="Cluster"]').filter(':contains(east)').should('have.length.at.least', 1);
    cy.wrap($rows).find('td[data-label="Cluster"]').filter(':contains(west)').should('have.length.at.least', 1);
    cy.wrap($rows)
      .find('td[data-label="Configuration"]')
      .find('[data-test="icon-correct-validation"]')
      .should('be.visible');
  });
});

Then('an entry for {string} cluster should be in the table', (cluster: string) => {
  cy.get('tbody').within(() => {
    cy.get('tr > td:nth-child(4)').contains(cluster).should('have.length.above', 0);
  });
});

// e.g. When user sorts the list by column "Cluster" in "ascending" order
When('user sorts the list by column {string} in {string} order', (column: string, order: SortOrder) => {
  cy.get(`th[data-label="${column}"]`).then($el => {
    // Already sorted by this column and order, do nothing.
    if ($el.attr('aria-sort') === order) {
      return;
    }

    // Three possible states:
    // 1. aria-sort attribute is none: not sorted, click once for ascending and twice for descending.
    // 2. aria-sort attribute is ascending: click once for descending.
    // 3. aria-sort attribute is descending: click once for ascending.
    if ($el.attr('aria-sort') === 'none') {
      if (order === SortOrder.Ascending) {
        cy.wrap($el).click();
        cy.wrap($el).should('have.attr', 'aria-sort', SortOrder.Ascending);
      } else if (order === SortOrder.Descending) {
        cy.wrap($el).click();
        cy.wrap($el).click();
        cy.wrap($el).should('have.attr', 'aria-sort', SortOrder.Descending);
      }
    } else if ($el.attr('aria-sort') === SortOrder.Ascending) {
      if (order === SortOrder.Descending) {
        cy.wrap($el).click();
        cy.wrap($el).should('have.attr', 'aria-sort', SortOrder.Descending);
      }
    } else if ($el.attr('aria-sort') === SortOrder.Descending) {
      if (order === SortOrder.Ascending) {
        cy.wrap($el).click();
        cy.wrap($el).should('have.attr', 'aria-sort', SortOrder.Ascending);
      }
    }
  });
});

// e.g. Then the list is sorted by column "Cluster" in "ascending" order
Then('the list is sorted by column {string} in {string} order', (column: string, order: SortOrder) => {
  // For each row, assert that every value in that col is <= the next row's value in that column.
  cy.get('tbody')
    .find('tr')
    .should($rows => {
      for (let i = 0; i < $rows.length - 1; i++) {
        const $row = $rows.eq(i);
        const $nextRow = $rows.eq(i + 1);

        const $col = $row.find(`td[data-label="${column}"]`);
        const $nextCol = $nextRow.find(`td[data-label="${column}"]`);

        if (order === SortOrder.Ascending) {
          expect($col.text().localeCompare($nextCol.text())).to.be.lte(
            0,
            `${$col.text()} should be <= ${$nextCol.text()}`
          );
        } else if (order === SortOrder.Descending) {
          expect($col.text().localeCompare($nextCol.text())).to.be.gte(
            0,
            `${$col.text()} should be >= ${$nextCol.text()}`
          );
        }
      }
    });
});

Then(
  'the {string} {string} for {string} cluster {string} namespace should not exist in the table',
  (name: string, object: string, cluster: string, ns: string) => {
    cy.get(`[data-test="VirtualItem_Cluster${cluster}_Ns${ns}_${object.toLowerCase()}_${name}"]`).should('not.exist');
  }
);
