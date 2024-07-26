import { Given } from '@badeball/cypress-cucumber-preprocessor';

const USERNAME = Cypress.env('USERNAME') ?? 'jenkins';
const PASSWD = Cypress.env('PASSWD');

// This user is not defined in a Cypress environment variable because
// It is used just for the multi clusters scripts to check permissions
// configured with Keycloak
export const BOOKINFO_USERNAME = 'bookinfouser';
const BOOKINFO_PASSWD = 'kiali';

Given('user is at administrator perspective', () => {
  cy.login(USERNAME, PASSWD);
});

Given('user visits base url', () => {
  cy.visit('/');
});

Given('user is at limited user perspective', () => {
  cy.login(BOOKINFO_USERNAME, BOOKINFO_PASSWD);
});
