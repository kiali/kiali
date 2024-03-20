import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { TableDefinition } from 'cypress-cucumber-preprocessor';

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
  'the {string} column on the {string} row has the text {string}',
  (column: string, rowText: string, text: string) => {
    getColWithRowText(rowText, column).contains(text);
  }
);

Then('the {string} column on the {string} row is empty', (column: string, rowText: string, text: string) => {
  getColWithRowText(rowText, column).children().should('be.empty');
});

Then('user clicks in {string} column on the {string} text', (column: string, rowText: string) => {
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
  cy.get('select[aria-label="filter_select_type"]').select(filter);
});

Then('user filters for name {string}', (name: string) => {
  cy.get('input[aria-label="filter_input_value"]').type(`${name}{enter}`);
});

Then('user filters for istio config type {string}', (istioType: string) => {
  cy.get('input[placeholder="Filter by Istio Config Type"]').type(`${istioType}{enter}`);
  cy.get(`button[label="${istioType}"]`).should('be.visible').click();
});

// checkCol
// This func assumes:
//
// 1. There is only 1 table on the screen.
//
// Be aware of these assumptions when using this func.
export function colExists(colName: string, exists: boolean) {
  return cy.get(`th[data-label="${colName}"]`).should(exists ? 'exist' : 'not.exist');
}

// getColWithRowText will find the column matching the unique row text and column header name.
// This func makes a couple assumptions:
//
// 1. The text to search for is unique in the row.
// 2. There is only 1 table on the screen.
//
// Be aware of these assumptions when using this func.
export function getColWithRowText(rowSearchText: string, colName: string) {
  // Get all the table headers and find the index of their col.
  return cy.get(`th[data-label="${colName}"]`).then($th => {
    // Get the col number
    const colNum = $th.attr('data-key');
    expect(colNum).to.not.be.empty;

    cy.log(`Looking in column named: ${colName} at index: ${colNum}`);

    return cy
      .get('tbody')
      .contains('tr', rowSearchText)
      .find('td')
      .then($cols => $cols[colNum]);
  });
}

// getCellsForCol returns every cell matching the table header name or
// the table header index. Example:
//
// | Name | Type | Health |
// | app1 | wkld | Good   |
// | app2 | svc  | Good   |
//
// getCellsForCol('Name') or getCellsForCol(0) would both return
// the cells 'app1' and 'app2'.
export function getCellsForCol(column: string | Number) {
  if (typeof column === 'number') {
    return cy.get(`td[data-key="${column}"]`);
  }
  return cy.get(`td[data-label="${column}"]`);
}

Then('user sees the {string} table with {int} rows', (tableName: string, numRows: number) => {
  let tableId = '';
  switch (tableName) {
    case 'Istio Config':
      tableId = 'list_istio_config';
      break;
  }
  cy.get('table[aria-label="' + tableId + '"]').within(() => {
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
      tableId = 'list_istio_config';
      break;
  }
  cy.get('table[aria-label="' + tableId + '"]').within(() => {
    cy.get('[data-test="istio-config-empty"]');
  });
});

When('user clicks in the {string} table {string} badge {string} name row link', (tableName, badge, name) => {
  let tableId = '';
  switch (tableName) {
    case 'Istio Config':
      tableId = 'list_istio_config';
      break;
  }
  cy.get('table[aria-label="' + tableId + '"]').within(() => {
    cy.contains('span', badge).siblings().first().click();
  });
});

// ensureObjectsInTable name can represent apps, istio config, objects, services etc.
export function ensureObjectsInTable(...names: string[]) {
  cy.get('tbody').within(() => {
    cy.get('tr').should('have.length.at.least', names.length);
    names.forEach(name => {
      cy.get('tr').contains(name);
    });
  });
}

export function checkHealthIndicatorInTable(
  targetNamespace: string,
  targetType: string | null,
  targetRowItemName: string,
  healthStatus: string
) {
  const selector = targetType
    ? `${targetNamespace}_${targetType}_${targetRowItemName}`
    : `${targetNamespace}_${targetRowItemName}`;
  cy.get(`[data-test=VirtualItem_Ns${selector}] svg[class=icon-${healthStatus}]`).should('exist');
}

export function checkHealthStatusInTable(
  targetNamespace: string,
  targetType: string | null,
  targetRowItemName: string,
  healthStatus: string
) {
  const selector = targetType
    ? `${targetNamespace}_${targetType}_${targetRowItemName}`
    : `${targetNamespace}_${targetRowItemName}`;
  cy.get(`[data-test=VirtualItem_Ns${selector}] td:first-child span`).trigger('mouseenter');
  cy.get(`[aria-label='Health indicator'] strong`).should('contain.text', healthStatus);
}
