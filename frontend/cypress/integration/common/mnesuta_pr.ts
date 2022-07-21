import { Before, Given, Then, When } from "cypress-cucumber-preprocessor/steps";

When("user fills {string} in find and submits", (input: string) => {
  cy.get('#graph_find').type(input+'{enter}')
})

Then("user sees the {string} message",(error: string)=> {
  cy.get('[aria-label="graph settings"]').should("contain.text",error)
})