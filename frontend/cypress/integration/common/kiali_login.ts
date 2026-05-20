import { Before, Given, Then } from '@badeball/cypress-cucumber-preprocessor';
import { discoverOAuthOrigin } from '../../support/oauth-utils';

const USERNAME = Cypress.env('USERNAME') ?? 'jenkins';
const PASSWD = Cypress.env('PASSWD');
const KUBEADMIN_IDP = Cypress.env('AUTH_PROVIDER');
const auth_strategy = Cypress.env('AUTH_STRATEGY');

/**
 * Fills a login form, handling cross-origin OAuth when needed.
 * Wraps the form interaction in cy.origin() if the OAuth server
 * differs from the Kiali base URL.
 */
function fillOAuthForm(
  formAction: (args: { password: string; username: string }) => void,
  args: { password: string; username: string }
): void {
  discoverOAuthOrigin().then(origin => {
    const baseOrigin = new URL(Cypress.config('baseUrl')!).origin;
    if (origin !== baseOrigin) {
      // Wait for the client-side redirect to the OAuth server to complete.
      const oauthHost = new URL(origin).host;
      cy.url().should('include', oauthHost);
      cy.origin(origin, { args }, formAction);
    } else {
      formAction(args);
    }
  });
}

// Defined as a named function so cy.origin() can serialize it.
// Cannot be imported from commands.ts due to cy.origin() serialization constraints.
function submitLoginForm({ username, password }: { password: string; username: string }): void {
  cy.get('#inputUsername').clear().type(username);
  cy.get('#inputPassword').type(password);
  cy.get('button[type="submit"]').click();
}

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

    cy.clearCookie('openshift-session-token');
  });
});

Given('user clicks my_htpasswd_provider', () => {
  if (auth_strategy === 'openshift' && KUBEADMIN_IDP !== '' && KUBEADMIN_IDP !== undefined) {
    cy.exec('kubectl get user').then(result => {
      if (result.stderr !== 'No resources found') {
        cy.log(`Log in using auth provider: ${KUBEADMIN_IDP}`);
        discoverOAuthOrigin().then(origin => {
          const baseOrigin = new URL(Cypress.config('baseUrl')!).origin;
          if (origin !== baseOrigin) {
            const oauthHost = new URL(origin).host;
            cy.url().should('include', oauthHost);
            cy.origin(origin, { args: { idp: KUBEADMIN_IDP } }, ({ idp }) => {
              cy.contains(idp).should('be.visible').click();
            });
          } else {
            cy.contains(KUBEADMIN_IDP).should('be.visible').click();
          }
        });
      }
    });
  }
});

Given('user fill in username and password', () => {
  if (auth_strategy === 'openshift') {
    cy.log(`Log in as user: ${USERNAME}`);
    fillOAuthForm(submitLoginForm, { username: USERNAME, password: PASSWD });
  }
});

Given('user fills in an invalid username', () => {
  if (auth_strategy === 'openshift') {
    const invalid = 'foobar';

    cy.log(`Log in with invalid username: ${invalid}`);
    cy.log(`The real username should be: ${USERNAME}`);
    fillOAuthForm(submitLoginForm, { username: invalid, password: PASSWD });
  }
});

Given('user fills in an invalid password', () => {
  if (auth_strategy === 'openshift') {
    cy.log(`Log in as user with wrong password: ${USERNAME}`);
    fillOAuthForm(submitLoginForm, { username: USERNAME, password: `${PASSWD.toLowerCase()}123456` });
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
    fillOAuthForm(submitLoginForm, { username: USERNAME, password: PASSWD });
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
    const usernameKey = `${cluster.toUpperCase()}_USERNAME`;
    const passwordKey = `${cluster.toUpperCase()}_PASSWD`;
    const username = Cypress.env(usernameKey);
    const password = Cypress.env(passwordKey);
    cy.log(`Log in as user with valid password: ${username}`);
    fillOAuthForm(submitLoginForm, { username, password });
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
