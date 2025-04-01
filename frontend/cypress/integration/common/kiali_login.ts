import { Before, Given, Then } from '@badeball/cypress-cucumber-preprocessor';

const USERNAME = Cypress.env('USERNAME') ?? 'jenkins'; // CYPRESS_USERNAME to the user
const PASSWD = Cypress.env('PASSWD'); // CYPRESS_PASSWD to the user
const KUBEADMIN_IDP = Cypress.env('AUTH_PROVIDER'); // CYPRESS_AUTH_PROVIDER to the user
const auth_strategy = Cypress.env('AUTH_STRATEGY');

Given('all sessions are cleared', () => {
  Cypress.session.clearAllSavedSessions();
  Cypress.session.clearCurrentSessionData();
});

Given('user opens base url', () => {
  cy.visit({ url: '/' });
  cy.log(auth_strategy);
  cy.window().then(() => {
    if (auth_strategy !== 'openshift') {
      cy.log('Skipping login, Kiali is running with auth disabled');
    }

    // Make sure we clear the cookie in case a previous test failed to logout.
    cy.clearCookie('openshift-session-token');
  });
});

Given('user clicks my_htpasswd_provider', () => {
  if (auth_strategy === 'openshift' && KUBEADMIN_IDP !== '' && KUBEADMIN_IDP !== undefined) {
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
  if (auth_strategy === 'token') {
    cy.exec('kubectl -n istio-system create token citest').then(result => {
      cy.get('#token').type(result.stdout);
      cy.get('button[type="submit"]').click();
    });
  }
});

Then('user fills in a valid password for {string} cluster', (cluster: string) => {
  if (auth_strategy === 'openshift') {
    const username = Cypress.env(`${cluster.toUpperCase()}_USERNAME`);
    const password = Cypress.env(`${cluster.toUpperCase()}_PASSWD`);
    cy.log(`Log in as user with valid password: ${username}`);

    cy.get('#inputUsername').clear().type(`${username}`);

    cy.get('#inputPassword').type(`${password}`);
    cy.get('button[type="submit"]').click();
  }
});

Then('user sees the Overview page', () => {
  cy.url().should('include', 'overview');
});

Then('the server will return a login error', () => {
  cy.intercept({ url: `**/api/auth/callback*`, query: { code: '*' } }, req => {
    req.query['code'] = 'invalidcode';
  });
});

Then('user sees an error message on the login form', () => {
  cy.contains('Openshift authentication failed.').should('be.visible');
});

Then('the error description is in the url', () => {
  cy.url().should('include', 'openshift_error');
});

Then('user sees the {string} clusters in the profile dropdown', (clusters: string) => {
  cy.getBySel('user-dropdown').click();
  clusters.split(',').forEach(cluster => {
    cy.getBySel('user-dropdown').contains(cluster).should('be.visible');
  });
});

Then('user clicks the {string} cluster in the profile dropdown', (cluster: string) => {
  cy.getBySel('user-dropdown').then($button => {
    if ($button.attr('aria-expanded') === 'false') {
      cy.wrap($button).click();
    }
  });
  cy.getBySel('user-dropdown').contains(`Login to ${cluster}`).should('be.visible').click();
});

Then('user session is expiring soon', () => {
  cy.intercept('GET', '**/api/auth/info', req => {
    req.continue(res => {
      res.body.sessionInfo.expiresOn = new Date(Date.now() + 10000).toISOString();
    });
  });
});

Then('user sees the session timeout modal', () => {
  cy.getBySel('session-timeout-modal').should('be.visible');
});

Then('user clicks logout on the session timeout modal', () => {
  cy.getBySel('session-timeout-logout-btn').should('be.visible').click();
});

Before({ tags: '@openshift' }, function () {
  if (auth_strategy !== 'openshift') {
    cy.log('Not running on Openshift, skipping openshift tests');
    this.skip();
  }
});

Before({ tags: '@requireslogin' }, function () {
  if (auth_strategy === 'anonymous') {
    cy.log(
      "You are using 'anonymous' auth strategy. This test requires an auth strategy that has some form of login and 'anonymous' does not. Skipping this test"
    );
    this.skip();
  }
});
