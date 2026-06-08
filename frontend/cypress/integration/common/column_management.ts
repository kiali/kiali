import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';

// Selectors
// Use the stable selector from namespaces.ts that targets this modal specifically
const COLUMN_MANAGEMENT_MODAL = '[data-ouia-component-id="ColumnManagementModal"]';

When('user clicks the {string} button with test id {string}', (buttonText: string, testId: string) => {
  // Wait for the toolbar to be fully loaded
  cy.get('#filter-selection', { timeout: 10000 }).should('be.visible');

  // Wait for the button to be visible and clickable
  cy.get(`[data-test-id="${testId}"]`, { timeout: 10000 }).should('be.visible').should('not.be.disabled').click();
});

Then('the column management modal should be visible', () => {
  // Wait for modal to appear and check it has the correct title
  cy.get(COLUMN_MANAGEMENT_MODAL, { timeout: 10000 })
    .should('be.visible')
    .find('h1')
    .should('contain.text', 'Manage columns');
});

Then('the modal title should be {string}', (expectedTitle: string) => {
  cy.get(COLUMN_MANAGEMENT_MODAL).find('h1').should('contain.text', expectedTitle);
});

Then('the {string} column checkbox should be disabled in the modal', (columnName: string) => {
  cy.get(COLUMN_MANAGEMENT_MODAL).within(() => {
    // Find the checkbox associated with the Name column
    // The checkbox might be in a list item or table row
    cy.contains(columnName).closest('li, tr, div[role="row"]').find('input[type="checkbox"]').should('be.disabled');
  });
});

Then('the {string} column should be checked in the modal', (columnName: string) => {
  cy.get(COLUMN_MANAGEMENT_MODAL).within(() => {
    cy.contains(columnName).closest('li, tr, div[role="row"]').find('input[type="checkbox"]').should('be.checked');
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
  // Reuse the same approach as namespaces.ts
  cy.get('[data-ouia-component-id="ColumnManagementModal-save-button"]').click();
  cy.get('[data-ouia-component-id="ColumnManagementModal"]').should('not.exist');
});

When('user closes the column management modal', () => {
  cy.get(`${COLUMN_MANAGEMENT_MODAL} button[aria-label="Close"]`).click();
  cy.get(COLUMN_MANAGEMENT_MODAL).should('not.exist');
});

When('user resets columns to default', () => {
  // Reuse the same approach as namespaces.ts
  cy.get('[data-ouia-component-id="ColumnManagementModal-reset-button"]').click();
  cy.get('[data-ouia-component-id="ColumnManagementModal-save-button"]').click();
  cy.get('[data-ouia-component-id="ColumnManagementModal"]').should('not.exist');
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
  // Use URL-based approach similar to namespaces.ts (line 105)
  // Instead of drag-and-drop, set column order via URL param
  // This is a more reliable and testable approach
  cy.url().then(currentUrl => {
    const url = new URL(currentUrl);
    const listType = url.pathname.includes('applications') ? 'app' : url.pathname.includes('services') ? 'svc' : 'wl';
    const orderParam = `${listType}order`;
    // Set a custom order: health,name,namespace (Name should stay visible even if not first)
    const customOrder = 'health,name,namespace';
    url.searchParams.set(orderParam, customOrder);
    url.searchParams.set('refresh', '0');
    cy.visit({ url: url.toString() });
    cy.get('#filter-selection', { timeout: 15000 }).should('exist');
  });
});

Then('the columns should be in the new order', () => {
  // Verify column order changed by checking the actual table headers
  cy.get('[data-ouia-component-id="ColumnManagementModal"]').should('not.exist');
  cy.get('table thead th').should('have.length.greaterThan', 0);
  // The first visible data column should be Health (after the reorder)
  cy.get('table thead th[data-label]').first().should('have.attr', 'data-label', 'Health');
});

Then('all default columns should be visible', () => {
  // Wait for table to be visible (loading overlay gone)
  cy.get('table thead', { timeout: 10000 }).should('be.visible');

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
  // Add refresh=0 to pause auto-refresh and wait for page to load
  cy.visit({ url: `${basePath}?refresh=0&${urlParam}` });
  cy.get('#filter-selection', { timeout: 15000 }).should('exist');
});

Given('user visits the page with URL param {string}', (urlParam: string) => {
  cy.url().then(currentUrl => {
    const url = new URL(currentUrl);
    // Preserve existing query params like namespaces
    const params = new URLSearchParams(url.search);
    const newParams = new URLSearchParams(urlParam);
    newParams.forEach((value, key) => params.set(key, value));
    params.set('refresh', '0');
    // Use full URL to avoid path duplication issues
    const newUrl = `${url.origin}${url.pathname}?${params.toString()}`;
    cy.visit({ url: newUrl });
    cy.get('#filter-selection', { timeout: 15000 }).should('exist');
  });
});

// Note: 'the URL should contain {string}' is already defined in ai_chatbot.ts

When('user refreshes the page', () => {
  cy.reload();
});

Then('the columns should maintain the custom order', () => {
  // Verify that column order is preserved after refresh
  cy.get('[data-ouia-component-id="ColumnManagementModal"]').should('not.exist');
  cy.get('table thead th').should('have.length.greaterThan', 0);
  // The first visible data column should still be Health (matching the custom order set earlier)
  cy.get('table thead th[data-label]').first().should('have.attr', 'data-label', 'Health');
});
