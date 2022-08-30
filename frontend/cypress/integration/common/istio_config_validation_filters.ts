import { When, Then, And } from "cypress-cucumber-preprocessor/steps";

// Some of the steps from istio_config_validation_filters.feature are implemented in
// the istio_config_type_filters.ts file. This is because some steps are identical.

function enableFilter(category:string){
  cy.get('select[aria-label="filter_select_value"]').select(category); 
}

When('user filters by {string} option', (category:string) => {
  enableFilter(category);
});

Then('user can see only the {string}', (category:string) => {
  cy.get('#filter-selection > :nth-child(2)').contains(category)
.parent().should('be.visible').and('have.length', 1);
});

When('a validation filter {string} is applied', (category:string) => {
  cy.get('select[aria-label="filter_select_value"]').select(category);
  cy.get('#filter-selection > :nth-child(2)').contains(category)
  .parent().should('be.visible');    
});

Then('the validation filter {string} is no longer active', (category:string) => {
  cy.get('#filter-selection').contains(category)
  .should('be.hidden');
});

And('the {string} validation filter is applied again', (category:string) => {
  enableFilter(category);
});

When("user chooses {int} validation filters", (count:number) => {
  for (let i = 1; i <= count; i++) {
    cy.get('select[aria-label="filter_select_value"]').select(i);
  };
});
