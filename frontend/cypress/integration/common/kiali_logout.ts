import { And, Then } from "@badeball/cypress-cucumber-preprocessor";

const auth_strategy = Cypress.env('auth_strategy')

And('user clicks on admin', () => {
    if (auth_strategy === 'openshift') {
        cy.get('#user-dropdown-toggle').click()
    }
})

And('user logout successfully', () => {
    if (auth_strategy === 'openshift') {
        cy.intercept('api/logout').as('logout')
        cy.get('.pf-c-dropdown__menu-item').click()
    }
})

Then('user verify the logout', () => {
    if (auth_strategy === 'openshift') {
        cy.wait('@logout').its('response.statusCode').should('eq', 204)
    }
})