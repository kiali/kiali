import { Given } from '@badeball/cypress-cucumber-preprocessor';

const USERNAME = Cypress.expose('USERNAME') ?? 'jenkins';

// This user is not defined in a Cypress environment variable because
// It is used just for the multi clusters scripts to check permissions
// configured with Keycloak
const BOOKINFO_USERNAME = 'bookinfouser';
const BOOKINFO_PASSWD = 'kiali';

Given('user is at administrator perspective', () => {
  cy.env(['PASSWD']).then(({ PASSWD }) => {
    cy.login(USERNAME, PASSWD);
  });
});

Given('user visits base url', () => {
  cy.visit({ url: '/' });
});

Given('user is at limited user perspective', () => {
  cy.login(BOOKINFO_USERNAME, BOOKINFO_PASSWD);
});
