import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { activeFilters, showMore } from './label_check';

const optionCheck = (name: string): void => {
  cy.get('button#filter_select_value-toggle').click();
  cy.get(`button[id="${name}"]`).should('exist');

  // close the select
  cy.get('button#filter_select_value-toggle').click();
};

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

  cy.get('button#filter_select_type-toggle').click();
  cy.get(`button[id="${filterCategory}"]`).click();
});

Then('no filters are active', () => {
  cy.get('#filter-selection > :nth-child(2)').should('be.hidden');
});

When('user expands the {string} dropdown', (placeholder: string) => {
  cy.get(`input[placeholder="${placeholder}"]`).click();
});

Then('user can see the filter options', () => {
  let filters: string[] = [
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

  cy.get(`input[placeholder="${placeholder}"]`).type('AuthorizationPolicy');
  cy.get(`li[label="AuthorizationPolicy"]`).should('be.visible').find('button').click();
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

  cy.get('input[placeholder="Filter by Type"]').type('AuthorizationPolicy');
  cy.get(`li[label="AuthorizationPolicy"]`).should('be.visible').find('button').click();
  cy.get('input[placeholder="Filter by Type"]').type('DestinationRule');
  cy.get(`li[label="DestinationRule"]`).should('be.visible').find('button').click();
});

Then('multiple filters are active', () => {
  cy.wait('@multipleFilters').its('response.statusCode').should('eq', 200);
});

When('a type filter {string} is applied', (category: string) => {
  cy.get('input[placeholder="Filter by Type"]').type(`${category}`);
  cy.get(`li[label="${category}"]`).should('be.visible').find('button').click();
});

When('user clicks the cross next to the {string}', (category: string) => {
  cy.get('#filter-selection > :nth-child(2)').contains(category).parent().parent().find('[aria-label="close"]').click();
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
  cy.get('button#filter_select_type-toggle').click();
  cy.get('button#Type').click();

  for (let i = 1; i <= count; i++) {
    cy.get('input[placeholder="Filter by Type"]').click();
    cy.get(`[data-test=istio-type-dropdown] > :nth-child(${i})`).should('be.visible').click();
    cy.get('#loading_kiali_spinner').should('not.exist');
  }
});

When('user clicks the cross on one of them', () => {
  cy.get('#filter-selection > :nth-child(2)')
    .find('[data-ouia-component-type="PF5/Button" data-ouia-component-id="close"]')
    .first()
    .click();
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
