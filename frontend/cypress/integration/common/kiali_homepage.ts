import { Given } from "cypress-cucumber-preprocessor/steps";
import { Then } from "cypress-cucumber-preprocessor/steps";

const url = "/"

Given('I open Kiali URL', () => {
  cy.visit(url)
})


Then(`I see {string} in the title`, (title) => {
  cy.title().should('include', title)
})