import { And, Given } from "@badeball/cypress-cucumber-preprocessor";

const USERNAME = Cypress.env('USERNAME') || 'jenkins';
const PASSWD = Cypress.env('PASSWD')

Given('user is at administrator perspective', () => {
    Cypress.Cookies.defaults({
        preserve: 'kiali-token-aes',
    })
    cy.login(USERNAME, PASSWD)
})

And('user visits base url', () => {
    cy.visit('/')
})