import { And, Then, When } from 'cypress-cucumber-preprocessor/steps';
import { getColWithRowText } from './table';

And('user filters for config {string}', (configName: string) => {
  cy.get('select[aria-label="filter_select_value"]').select(configName);
});

Then('user sees all the Istio Config objects in the bookinfo namespace', () => {
  // There should be two Istio Config objects in the bookinfo namespace
  // represented by two rows in the table.
  cy.get('tbody').within(() => {
    // Bookinfo VS
    cy.get('tr').contains('bookinfo');
    // Bookinfo Gateway
    cy.get('tr').contains('bookinfo-gateway');
  });
});

And('user sees Name information for Istio objects', () => {
  const object = 'bookinfo-gateway';
  // There should be a table with a heading for each piece of information.
  getColWithRowText(object, 'Name').within(() => {
    cy.get(`a[href*="/namespaces/bookinfo/istio/gateways/${object}"]`).should('be.visible');
  });
});

And('user sees Namespace information for Istio objects', () => {
  const object = 'bookinfo-gateway';

  getColWithRowText(object, 'Namespace').contains('bookinfo');
});

And('user sees Type information for Istio objects', () => {
  const object = 'bookinfo-gateway';

  getColWithRowText(object, 'Type').contains('Gateway');
});

And('user sees Configuration information for Istio objects', () => {
  const object = 'bookinfo-gateway';
  // There should be a table with a heading for each piece of information.
  getColWithRowText(object, 'Configuration').within(() => {
    cy.get(`a[href*="/namespaces/bookinfo/istio/gateways/${object}"]`).should('be.visible');
  });
});

And('the user filters by {string} for {string}', (filter: string, filterValue: string) => {
  if (filter === 'Istio Name') {
    cy.get('select[aria-label="filter_select_type"]').select(filter);
    cy.get('input[aria-label="filter_input_value"]').type(`${filterValue}{enter}`);
  } else if (filter === 'Istio Type') {
    cy.get('select[aria-label="filter_select_type"]').select('Istio Type');
    cy.get('input[placeholder="Filter by Istio Type"]').type(`${filterValue}{enter}`);
  } else if (filter === 'Config') {
    cy.get('select[aria-label="filter_select_type"]').select(filter);
    cy.get('select[aria-label="filter_select_value"]').select(filterValue);
  } else if (filter === 'App Name') {
    cy.get('select[aria-label="filter_select_type"]').select(filter);
    cy.get('input[aria-label="filter_input_value"]').type(`${filterValue}{enter}`);
  } else if (filter === 'Istio Sidecar') {
    cy.get('select[aria-label="filter_select_type"]').select(filter);
    cy.get('select[aria-label="filter_select_value"]').select(filterValue);
  } else if (filter === 'Health') {
    cy.get('select[aria-label="filter_select_type"]').select(filter);
    cy.get('select[aria-label="filter_select_value"]').select(filterValue);
  } else if (filter === 'Label') {
    cy.get('select[aria-label="filter_select_type"]').select(filter);
    cy.get('input[aria-label="filter_input_label_key"]').type(`${filterValue}{enter}`);
  }
});

Then('user only sees {string}', (sees: string) => {
  cy.get('tbody').contains('tr', sees);
  cy.get('tbody').within(() => {
    cy.get('tr').should('have.length', 1);
  });
});

Then('user sees {string}', (sees: string) => {
  cy.get('tbody').contains('tr', sees);
});

Then('the user can create a {string} Istio object', (object: string) => {
  cy.getBySel('actions-dropdown').click();
  cy.getBySel('actions-dropdown').within(() => {
    cy.contains(object).click();
  });
  const page = `/istio/new/${object}`;
  cy.url().should('include', page);
});
