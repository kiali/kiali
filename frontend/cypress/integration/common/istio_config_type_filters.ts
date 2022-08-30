import { When, Then, And } from "cypress-cucumber-preprocessor/steps";
import { activeFilters, showMore} from "./label_check"

function enableFilter(category:string){
  cy.get('button[aria-label="Options menu"]').click(); 
  cy.get('[data-test=istio-type-dropdown]').contains(category)
  .should('be.visible').click();
}

When("user types {string} into the input", (input:string) => {
  // cy.get('button[aria-label="Options menu"]').click();
  cy.get('input[placeholder="Filter by Istio Type"]').type(input);
});

Then("the {string} phrase is displayed", (phrase:string) => {
  cy.get('#filter-selection').contains(phrase).should('be.visible'); 
});

And('user filters by {string}', (filterCategory:string) => {
  cy.get('select[aria-label="filter_select_type"]').select(filterCategory)
});

And('no filters are active', () => {
  cy.get('#filter-selection > :nth-child(2)').should('be.hidden');
});

When('user chooses a {string}', (category:string) => {
  enableFilter(category);
});

Then('user can see only the {string}', (category:string) => {
  cy.get('#filter-selection > :nth-child(2)').contains(category)
.parent().should('be.visible').and('have.length', 1);
});

When('a type filter {string} is applied', (category:string) => {
  cy.get('button[aria-label="Options menu"]').click();
    cy.get('[data-test=istio-type-dropdown]').contains(category)
    .should('be.visible').click().then( () =>{
      cy.get('#filter-selection > :nth-child(2)').contains(category)
      .parent().should('be.visible');    
  }); 
});

And('user clicks the cross next to the {string}', (category:string) => {
  cy.get('#filter-selection > :nth-child(2)').contains(category).parent()
  .find('[aria-label="close"]').click();
});

Then('the filter {string} is no longer active', (category:string) => {
  cy.get('#filter-selection').contains(category)
  .should('not.exist');
});

And('the {string} type filter is applied again', (category:string) => {
  enableFilter(category);
});

Then('the filter {string} should be visible only once', (category:string) => {
  cy.get('#filter-selection > :nth-child(2)').find("span")
  .contains(category).each(() => {
  })
  .then(($lis) => {
    expect($lis).to.have.length(1);
  });
});

When("user chooses {int} type filters", (count:number) => {
  for (let i = 1; i <= count; i++) {
    cy.get('button[aria-label="Options menu"]').click(); 
    cy.get(`[data-test=istio-type-dropdown] > :nth-child(${i})`)
    .should('be.visible').click();
  };
});

And("user clicks the cross on one of them", () => {
  cy.get('#filter-selection > :nth-child(2)').find('[aria-label="close"]')
  .first().click();
});

Then("{int} filters should be visible", (count:number) => {
  activeFilters(count);
});

Then("he can only see {int} right away", (count:number) => {
  activeFilters(count);
});

And("clicks on the button next to them", () => {
  showMore();
});

Then("he can see the remaining filter", () => {
  activeFilters(4);
});

And("makes them all visible", () => {
  showMore();
  activeFilters(4);
});

When("user clicks on {string}", (label:string) => {
  cy.get('#filter-selection > :nth-child(2)').contains(label).click();
});

Then("he can see only {int} filters", (count:number) => {
  activeFilters(count);
});

When("all type filters are enabled", () => {
  for (let i = 1; i <= 11; i++) {
      cy.get('button[aria-label="Options menu"]').click(); 
      cy.get(`[data-test=istio-type-dropdown] > :nth-child(${i})`)
      .should('be.visible').click();
    };
});
