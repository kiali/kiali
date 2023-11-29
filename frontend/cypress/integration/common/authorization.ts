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

Given('user is logged as administrator in Openshift Web Console', () => {
    Cypress.Cookies.defaults({
        preserve: 'some-ocp-web-console-cookie',
    })
    cy.loginOSSMC(USERNAME, PASSWD)
})