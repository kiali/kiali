import { Given } from '@badeball/cypress-cucumber-preprocessor';

const USERNAME = Cypress.env('USERNAME') ?? 'jenkins';
const PASSWD = Cypress.env('PASSWD');

Given('user is at administrator perspective', () => {
  cy.login(USERNAME, PASSWD);
});

Given('user visits base url', () => {
  cy.visit('/');
});
