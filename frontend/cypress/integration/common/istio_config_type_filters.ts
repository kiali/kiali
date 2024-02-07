import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { activeFilters, showMore } from './label_check';

function optionCheck(name: string) {
  cy.get('[aria-label="filter_select_value"]').contains(name).should('exist');
}

When('user types {string} into the input', (input: string) => {
  cy.get('input[placeholder="Filter by Type"]').type(input);
});

Then('the {string} phrase is displayed', (phrase: string) => {
  cy.get('#filter-selection').contains(phrase).should('be.visible');
});

When('user filters by {string}', (filterCategory: string) => {
  cy.intercept({
    pathname: '**/api/istio/config',
    query: {
      objects: ''
    }
  }).as('noFilters');
  cy.get('select[aria-label="filter_select_type"]').select(filterCategory);
});

Then('no filters are active', () => {
  cy.get('#filter-selection > :nth-child(2)').should('be.hidden');
});

When('user expands the {string} dropdown', (placeholder: string) => {
  cy.get(`input[placeholder="${placeholder}"]`).click();
});

Then('user can see the filter options', () => {
  const filters: string[] = [
    'AuthorizationPolicy',
    'DestinationRule',
    'EnvoyFilter',
    'Gateway',
    'PeerAuthentication',
    'RequestAuthentication',
    'ServiceEntry',
    'Sidecar',
    'Telemetry',
    'VirtualService',
    'WasmPlugin',
    'WorkloadEntry',
    'WorkloadGroup'
  ];
  filters.forEach(optionCheck);
});

When('chosen from the {string} dropdown', (placeholder: string) => {
  cy.intercept({
    pathname: '**/api/istio/config',
    query: {
      objects: 'authorizationpolicies'
    }
  }).as('filterActive');
  cy.get(`input[placeholder="${placeholder}"]`).type('AuthorizationPolicy{enter}');
  cy.get(`button[label="AuthorizationPolicy"]`).should('be.visible').click();
});

Then('the filter is applied', () => {
  cy.wait('@filterActive').its('response.statusCode').should('eq', 200);
});

When('multiple filters are chosen', () => {
  cy.intercept({
    pathname: '**/api/istio/config',
    query: {
      objects: 'authorizationpolicies,destinationrules'
    }
  }).as('multipleFilters');
  cy.get('input[placeholder="Filter by Type"]').type('AuthorizationPolicy{enter}');
  cy.get(`button[label="AuthorizationPolicy"]`).should('be.visible').click();
  cy.get('input[placeholder="Filter by Type"]').type('DestinationRule{enter}');
  cy.get(`button[label="DestinationRule"]`).should('be.visible').click();
});

Then('multiple filters are active', () => {
  cy.wait('@multipleFilters').its('response.statusCode').should('eq', 200);
});

When('a type filter {string} is applied', (category: string) => {
  cy.get('input[placeholder="Filter by Type"]').type(`${category}{enter}`);
  cy.get(`button[label="${category}"]`).should('be.visible').click();
});

When('user clicks the cross next to the {string}', (category: string) => {
  cy.get('#filter-selection > :nth-child(2)').contains(category).parent().find('[aria-label="close"]').click();
});

Then('the filter is no longer active', () => {
  cy.wait('@noFilters').its('response.statusCode').should('eq', 200);
});

Then('the filter {string} should be visible only once', (category: string) => {
  cy.get('#filter-selection > :nth-child(2)')
    .find('span')
    .contains(category)
    .each(() => {})
    .then($lis => {
      expect($lis).to.have.length(1);
    });
});

When('user chooses {int} type filters', (count: number) => {
  cy.get('select[aria-label="filter_select_type"]').select('Type');
  for (let i = 1; i <= count; i++) {
    cy.get('input[placeholder="Filter by Type"]').click();
    cy.get(`[data-test=istio-type-dropdown] > :nth-child(${i})`).should('be.visible').click();
    cy.get('#loading_kiali_spinner').should('not.exist');
  }
});

When('user clicks the cross on one of them', () => {
  cy.get('#filter-selection > :nth-child(2)').find('[aria-label="close"]').first().click();
});

Then('{int} filters should be visible', (count: number) => {
  activeFilters(count);
});

Then('he can only see {int} right away', (count: number) => {
  activeFilters(count);
});

When('clicks on the button next to them', () => {
  showMore();
});

Then('he can see the remaining filter', () => {
  activeFilters(4);
});

When('makes them all visible', () => {
  showMore();
  activeFilters(4);
});

When('user clicks on {string}', (label: string) => {
  cy.get('#filter-selection > :nth-child(2)').contains(label).click();
  cy.get('#loading_kiali_spinner').should('not.exist');
});

Then('he can see only {int} filters', (count: number) => {
  activeFilters(count);
});
