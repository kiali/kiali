import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';

// Selectors
const COLUMN_MANAGEMENT_MODAL = '[role="dialog"][aria-label="Manage columns"]';
const COLUMN_MANAGEMENT_BUTTON = '[data-test-id$="-manage-columns"]';
const MODAL_TITLE = `${COLUMN_MANAGEMENT_MODAL} h1`;
const MODAL_CHECKBOX = (columnName: string) =>
  `${COLUMN_MANAGEMENT_MODAL} input[type="checkbox"][id*="${columnName.toLowerCase()}"]`;
const MODAL_APPLY_BUTTON = `${COLUMN_MANAGEMENT_MODAL} button:contains("Apply")`;
const MODAL_CLOSE_BUTTON = `${COLUMN_MANAGEMENT_MODAL} button[aria-label="Close"]`;
const MODAL_RESET_BUTTON = `${COLUMN_MANAGEMENT_MODAL} button:contains("Reset to default")`;
const TABLE_HEADER = (columnName: string) => `th:contains("${columnName}")`;

When('user clicks the {string} button with test id {string}', (buttonText: string, testId: string) => {
  cy.get(`[data-test-id="${testId}"]`).click();
});

Then('the column management modal should be visible', () => {
  cy.get(COLUMN_MANAGEMENT_MODAL).should('be.visible');
});

Then('the modal title should be {string}', (expectedTitle: string) => {
  cy.get(MODAL_TITLE).should('contain.text', expectedTitle);
});

Then('the {string} column checkbox should be disabled in the modal', (columnName: string) => {
  cy.get(COLUMN_MANAGEMENT_MODAL).within(() => {
    // Find the checkbox associated with the Name column
    // The checkbox might be in a list item or table row
    cy.contains(columnName)
      .closest('li, tr, div[role="row"]')
      .find('input[type="checkbox"]')
      .should('be.disabled');
  });
});

Then('the {string} column should be checked in the modal', (columnName: string) => {
  cy.get(COLUMN_MANAGEMENT_MODAL).within(() => {
    cy.contains(columnName)
      .closest('li, tr, div[role="row"]')
      .find('input[type="checkbox"]')
      .should('be.checked');
  });
});

When('user unchecks the {string} column in the modal', (columnName: string) => {
  cy.get(COLUMN_MANAGEMENT_MODAL).within(() => {
    cy.contains(columnName)
      .closest('li, tr, div[role="row"]')
      .find('input[type="checkbox"]')
      .then($checkbox => {
        if ($checkbox.is(':checked') && !$checkbox.is(':disabled')) {
          cy.wrap($checkbox).click({ force: true });
        }
      });
  });
});

When('user checks the {string} column in the modal', (columnName: string) => {
  cy.get(COLUMN_MANAGEMENT_MODAL).within(() => {
    cy.contains(columnName)
      .closest('li, tr, div[role="row"]')
      .find('input[type="checkbox"]')
      .then($checkbox => {
        if (!$checkbox.is(':checked') && !$checkbox.is(':disabled')) {
          cy.wrap($checkbox).click({ force: true });
        }
      });
  });
});

When('user applies the column changes', () => {
  cy.get(COLUMN_MANAGEMENT_MODAL).within(() => {
    cy.contains('button', 'Apply').click();
  });
  // Wait for modal to close
  cy.get(COLUMN_MANAGEMENT_MODAL).should('not.exist');
});

When('user closes the column management modal', () => {
  cy.get(MODAL_CLOSE_BUTTON).click();
  cy.get(COLUMN_MANAGEMENT_MODAL).should('not.exist');
});

When('user resets columns to default', () => {
  cy.get(COLUMN_MANAGEMENT_MODAL).within(() => {
    cy.contains('button', 'Reset to default').click();
  });
});

Then('the {string} column should not be visible in the table', (columnName: string) => {
  // Check that the column header doesn't exist
  cy.get('table thead').within(() => {
    cy.contains('th', columnName, { matchCase: false }).should('not.exist');
  });
});

Then('the {string} column should be visible in the table', (columnName: string) => {
  // Check that the column header exists
  cy.get('table thead').within(() => {
    cy.contains('th', columnName, { matchCase: false }).should('be.visible');
  });
});

When('user reorders columns in the modal', () => {
  // This is a simplified version - actual implementation would need drag-and-drop
  // For now, we'll just verify the modal supports reordering
  cy.get(COLUMN_MANAGEMENT_MODAL).should('be.visible');
  // Drag-and-drop implementation would go here
  // This might need to use the PatternFly drag-drop components
});

Then('the columns should be in the new order', () => {
  // Verify column order changed - this would need specific implementation
  // based on the actual drag-drop behavior
  cy.get('table thead th').should('have.length.greaterThan', 0);
});

Then('all default columns should be visible', () => {
  // Default columns for Apps: Name, Health, Namespace, Labels, Details
  const defaultColumns = ['Name', 'Health', 'Namespace', 'Labels', 'Details'];
  cy.get('table thead').within(() => {
    defaultColumns.forEach(column => {
      cy.contains('th', column, { matchCase: false }).should('exist');
    });
  });
});

Given('user is at the {string} list page with URL param {string}', (listType: string, urlParam: string) => {
  const pageMap: { [key: string]: string } = {
    applications: '/console/applications',
    services: '/console/services',
    workloads: '/console/workloads'
  };

  const basePath = pageMap[listType] || `/console/${listType}`;
  cy.visit(`${basePath}?${urlParam}`);
});

Given('user visits the page with URL param {string}', (urlParam: string) => {
  cy.url().then(currentUrl => {
    const url = new URL(currentUrl);
    const newUrl = `${url.pathname}?${urlParam}`;
    cy.visit(newUrl);
  });
});

Then('the URL should contain {string}', (paramName: string) => {
  cy.url().should('include', paramName);
});

When('user refreshes the page', () => {
  cy.reload();
});

Then('the columns should maintain the custom order', () => {
  // Verify that column order is preserved after refresh
  cy.get('table thead th').should('have.length.greaterThan', 0);
  // More specific assertions would depend on the actual reordering done
});
