import { Given } from '@badeball/cypress-cucumber-preprocessor';

const USERNAME = Cypress.env('USERNAME') ?? 'jenkins';
const PASSWD = Cypress.env('PASSWD');

const BOOKINFO_USERNAME = Cypress.env('BOOKINFO_USERNAME') ?? 'bookinfouser';
const BOOKINFO_PASSWD = Cypress.env('BOOKINFO_PASSWD') ?? 'kiali';

Given('user is at administrator perspective', () => {
  cy.login(USERNAME, PASSWD);
});

Given('user visits base url', () => {
  cy.visit('/');
});

Given('user is at limited user perspective', () => {
  cy.login(BOOKINFO_USERNAME, BOOKINFO_PASSWD);
});
