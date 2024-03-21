import { Given } from '@badeball/cypress-cucumber-preprocessor';

const USERNAME = Cypress.env('USERNAME') ?? 'jenkins';
const PASSWD = Cypress.env('PASSWD');

Given('user is at administrator perspective', () => {
  cy.session(USERNAME, () => {
    cy.login(USERNAME, PASSWD);
  },{cacheAcrossSpecs:true});
});

Given('user visits base url', () => {
  cy.visit('/');
});
