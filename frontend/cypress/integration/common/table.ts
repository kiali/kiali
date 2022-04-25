import { And, Then, When } from 'cypress-cucumber-preprocessor/steps';
import { TableDefinition } from 'cypress-cucumber-preprocessor';

Then(`user sees a table with headings`, (tableHeadings: TableDefinition) => {
  const headings = tableHeadings.raw()[0];
  cy.get('table');
  headings.forEach(heading => {
    cy.get(`th[data-label="${heading}"]`);
  });
});

And(
  'the {string} column on the {string} row has a link ending in {string}',
  (column: string, rowText: string, link: string) => {
    getColWithRowText(rowText, column).within(() => {
      // $= is endswith since console link can change depending on the deployment.
      cy.get(`a[href$="${link}"]`).should('be.visible');
    });
  }
);

And(
  'the {string} column on the {string} row has the text {string}',
  (column: string, rowText: string, text: string) => {
    getColWithRowText(rowText, column).contains(text);
  }
);

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

And('table length should be {int}', (numRows: number) => {
  cy.get('tbody').within(() => {
    cy.get('tr').should('have.length', numRows);
  });
});

When('user selects filter {string}', (filter: string) => {
  cy.get('select[aria-label="filter_select_type"]').select(filter);
});

And('user filters for name {string}', (name: string) => {
  cy.get('input[aria-label="filter_input_value"]').type(`${name}{enter}`);
});

When('user filters by {string} istio type', (istioType: string) => {
  cy.get('select[aria-label="filter_select_type"]').select('istiotype');
});

And('user filters for istio type {string}', (istioType: string) => {
  cy.get('input[placeholder="Filter by Istio Type"]').type(`${istioType}{enter}`);
});

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
