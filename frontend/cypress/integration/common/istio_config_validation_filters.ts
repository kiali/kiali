import { Then, When } from '@badeball/cypress-cucumber-preprocessor';

// Some of the steps from istio_config_validation_filters.feature are implemented in
// the istio_config_type_filters.ts file. This is because some steps are identical.

const enableFilter = (category: string): void => {
  cy.get('select[aria-label="filter_select_value"]').select(category);
};

const optionCheck = (name: string): void => {
  cy.get('@filterDropdown').contains(name).should('exist');
};

Then('user can see the Filter by Config Validation dropdown', () => {
  cy.get('[aria-label="filter_select_value"]').as('filterDropdown').should('be.visible');
});

Then('the dropdown contains all of the filters', () => {
  const filters: string[] = ['Valid', 'Not Valid', 'Not Validated', 'Warning'];
  filters.forEach(optionCheck);
});

When('a validation filter is chosen from the dropdown', () => {
  cy.intercept({
    pathname: '**/api/istio/config'
  }).as('tableReload');
  enableFilter('Valid');
});

Then('the filter is applied and visible', () => {
  cy.wait('@tableReload').its('response.statusCode').should('eq', 200);
  cy.get('#filter-selection > :nth-child(2)').contains('Valid').should('be.visible');
});

Then('user can see only the {string}', (category: string) => {
  cy.get('#filter-selection > :nth-child(2)').contains(category).parent().should('be.visible').and('have.length', 1);
});

When('a validation filter {string} is applied', (category: string) => {
  cy.get('select[aria-label="filter_select_value"]').select(category);
  cy.get('#filter-selection > :nth-child(2)').contains(category).parent().should('be.visible');
});

Then('the validation filter {string} is no longer active', (category: string) => {
  cy.wait('@tableReload').its('response.statusCode').should('eq', 200);
  cy.get('#filter-selection').contains(category).should('be.hidden');
});

When('user chooses {int} validation filters', (count: number) => {
  cy.get('select[aria-label="filter_select_type"]', { timeout: 1000 }).should('be.visible').select('Config');
  cy.get('select[aria-label="filter_select_value"]', { timeout: 2000 }).should('be.visible');

  for (let i = 1; i <= count; i++) {
    cy.get('select[aria-label="filter_select_value"]').select(i);
    cy.get('#loading_kiali_spinner').should('not.exist');
  }
});
