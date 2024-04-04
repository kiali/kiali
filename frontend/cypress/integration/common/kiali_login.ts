import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';

const USERNAME = Cypress.env('USERNAME') ?? 'jenkins'; // CYPRESS_USERNAME to the user
const PASSWD = Cypress.env('PASSWD'); // CYPRESS_PASSWD to the user
const KUBEADMIN_IDP = Cypress.env('AUTH_PROVIDER'); // CYPRESS_AUTH_PROVIDER to the user
const auth_strategy = Cypress.env('AUTH_STRATEGY');

Given('user opens base url', () => {
  cy.visit('/');
  cy.log(auth_strategy);
  cy.window().then((win: any) => {
    if (auth_strategy !== 'openshift') {
      cy.log('Skipping login, Kiali is running with auth disabled');
    }

    // Make sure we clear the cookie in case a previous test failed to logout.
    cy.clearCookie('openshift-session-token');
  });
});

Given('user clicks my_htpasswd_provider', () => {
  if (auth_strategy === 'openshift') {
    cy.exec('kubectl get user').then(result => {
      if (result.stderr !== 'No resources found') {
        cy.log(`Log in using auth provider: ${KUBEADMIN_IDP}`);

        cy.contains(KUBEADMIN_IDP).should('be.visible').click();
      }
    });
  }
});

Given('user fill in username and password', () => {
  if (auth_strategy === 'openshift') {
    cy.log(`Log in as user: ${USERNAME}`);

    cy.get('#inputUsername')
      .clear()
      .type('' || USERNAME);

    cy.get('#inputPassword').type('' || PASSWD);
    cy.get('button[type="submit"]').click();
  }
});

Given('user does not fill in username and password', () => {
  if (auth_strategy === 'openshift') {
    cy.log('Log in with empty credentials');
    cy.get('button[type="submit"]').click();
  }
});

Given('user fills in an invalid username', () => {
  if (auth_strategy === 'openshift') {
    let invalid = 'foobar';

    cy.log(`Log in with invalid username: ${invalid}`);
    cy.log(`The real username should be: ${USERNAME}`);

    cy.get('#inputUsername')
      .clear()
      .type('' || invalid);

    cy.get('#inputPassword').type('' || PASSWD);
    cy.get('button[type="submit"]').click();
  }
});

Given('user fills in an invalid password', () => {
  if (auth_strategy === 'openshift') {
    cy.log(`Log in as user with wrong password: ${USERNAME}`);

    cy.get('#inputUsername')
      .clear()
      .type('' || USERNAME);

    cy.get('#inputPassword').type('' || `${PASSWD.toLowerCase()}123456`);
    cy.get('button[type="submit"]').click();
  }
});

Then('user see console in URL', () => {
  if (auth_strategy === 'openshift') {
    cy.url().should('include', 'console');
  }
});

Then('user sees the {string} phrase displayed', (phrase: string) => {
  if (auth_strategy === 'openshift') {
    cy.contains(phrase).should('be.visible');

    cy.url().should('include', 'login');
  }
});

Then('user fills in a valid password', () => {
  if (auth_strategy === 'openshift') {
    cy.log(`Log in as user with valid password: ${USERNAME}`);

    cy.get('#inputUsername').clear().type(`${USERNAME}`);

    cy.get('#inputPassword').type(`${PASSWD}`);
    cy.get('button[type="submit"]').click();
  }
});

Then('user sees the Overview page', () => {
  cy.get('div[data-test="overview-app-health"]').should('exist');
});
