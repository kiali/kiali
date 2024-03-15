import { Then, When } from '@badeball/cypress-cucumber-preprocessor';

// Some of the steps from istio_config_validation_filters.feature are implemented in
// the istio_config_type_filters.ts file. This is because some steps are identical.

const enableFilter = (category: string): void => {
  cy.get('button#filter_select_value-toggle').click();
  cy.get(`button[id="${category}"]`).click();
};

const optionCheck = (name: string): void => {
  cy.get('@filterDropdown').click();
  cy.get(`button[id="${name}"]`).should('exist');

  // close the select
  cy.get('@filterDropdown').click();
};

Then('user can see the Filter by Config Validation dropdown', () => {
  cy.get('button#filter_select_value-toggle').as('filterDropdown').should('be.visible');
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
  cy.get('button#filter_select_value-toggle').click();
  cy.get(`button[id="${category}"]`).click();

  cy.get('#filter-selection > :nth-child(2)').contains(category).parent().should('be.visible');
});

Then('the validation filter {string} is no longer active', (category: string) => {
  cy.wait('@tableReload').its('response.statusCode').should('eq', 200);
  cy.get('#filter-selection').contains(category).should('be.hidden');
});

When('user chooses {int} validation filters', (count: number) => {
  cy.get('button#filter_select_type-toggle', { timeout: 1000 }).should('be.visible').click();
  cy.get('button#Config').should('be.visible').click();

  cy.get('button#filter_select_value-toggle', { timeout: 2000 }).should('be.visible');

  for (let i = 0; i < count; i++) {
    cy.get('button#filter_select_value-toggle').click();
    cy.get('div#filter_select_value').find('button').eq(i).click();

    cy.get('#loading_kiali_spinner').should('not.exist');
  }
});
