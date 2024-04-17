// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

declare namespace Cypress {
  interface Chainable<Subject> {
    /**
     * Custom command to select DOM element by the 'data-test' attribute.
     * @param selector the DOM element selector
     * @param args the rest of DOM element args
     * @example cy.getBySel('greeting')
     */
    getBySel(selector: string, ...args: any): Chainable<Subject>;

    /**
     * Custom command to check if a DOM element has specific CSS variable
     * @param styleName the style name (e.g., color, margin, padding)
     * @param cssVarName the css variable name
     * @example cy.get(...).hasCssVar('color','--my-color')
     */
    hasCssVar(styleName: string, cssVarName: string): void;

    /**
     * Custom command to check text validation for inputs.
     * @param id the input identifier
     * @param text the text to validate
     * @param valid check if the text must be valid or invalid
     * @example cy.inputValidation('hostname','host',false)
     */
    inputValidation(id: string, text: string, valid: boolean): Chainable<Subject>;

    /**
     * Login to Kiali with the given username and password.
     * Sets the 'kiali-token-aes' cookie for later use.
     *
     * Provider will be determined by the environment variable AUTH_PROVIDER
     * and auth strategy is fetched from the Kiali API.
     * @param username
     * @param password
     */
    login(username: string, password: string): Chainable<Subject>;

    /**
     * Logout from Kiali
     */
    logout(): Chainable<Subject>;
  }
}
// cy.exec('kubectl -n istio-system create token citest').then(result => {
//   cy.get('#token').type(result.stdout);
//   cy.get('button[type="submit"]').click();
// });

const timeout = 300000; // 5 minutes

function ensureMulticlusterApplicationsAreHealthy(): void {
  const startTime = this.startTime || Date.now();
  this.startTime = startTime;

  if (Date.now() - startTime > timeout) {
    cy.log('Timeout reached without meeting the condition.');
    return;
  }

  cy.request(
    'api/clusters/apps?namespaces=bookinfo&clusterName=west&health=true&istioResources=true&rateInterval=60s'
  ).then(resp => {
    const has_http_200 = resp.body.applications.some(
      app =>
        app.name === 'reviews' &&
        app.cluster === 'west' &&
        app.health.requests.inbound.http !== undefined &&
        app.health.requests.inbound.http['200'] > 0
    );
    if (has_http_200) {
      cy.log("'reviews' app in 'west' cluster is healthy enough.");
    } else {
      cy.log("'reviews' app in 'west' cluster is not healthy yet, checking again in 10 seconds...");
      cy.wait(10000);
      ensureMulticlusterApplicationsAreHealthy();
    }
  });
}

Cypress.Commands.add('login', (username: string, password: string) => {
  const auth_strategy = Cypress.env('AUTH_STRATEGY');
  cy.session(
    username,
    () => {
      if (auth_strategy === 'openshift') {
        cy.log('Logging in with openshift auth strategy');
        if (password === '' || password === undefined) {
          throw new Error(
            'Password is required for login with openshift auth strategy. Please set CYPRESS_PASSWD environment variable.'
          );
        }

        cy.intercept('/api/namespaces').as('getNamespaces');
        cy.intercept('/api/config').as('getConfig');
        cy.intercept('/api/status').as('getStatus');
        cy.intercept('/api/tracing').as('getTracing');
        cy.intercept('/api/auth/info').as('getAuthInfo');

        cy.visit('');
        // TODO: Click idp if necessary.
        cy.get('#inputUsername')
          .clear()
          .type('' || username);

        cy.get('#inputPassword').type('' || password);
        cy.get('button[type="submit"]').click();

        // Wait for post login routes to be loaded. Otherwise cypress redirects you back to the home page
        // which causes other tests to fail: https://github.com/cypress-io/cypress/issues/1713.
        cy.wait('@getNamespaces');
        cy.wait('@getConfig');
        cy.wait('@getStatus');
        cy.wait('@getTracing');
        cy.wait('@getAuthInfo');

        // cy.contains(KUBEADMIN_IDP).should('be.visible').click();
      } else if (auth_strategy === 'openid') {
        // Only works with keycloak at the moment.
        cy.log('Logging in with OpenID');
        if (password === '' || password === undefined) {
          throw new Error(
            'Password is required for login with openid auth strategy. Please set CYPRESS_PASSWD environment variable.'
          );
        }

        cy.request('api/auth/info').then(({ body }) => {
          let authEndpoint = body.authorizationEndpoint;
          cy.request({
            url: authEndpoint,
            method: 'GET',
            followRedirect: true
          }).then(resp => {
            const $html = Cypress.$(resp.body);
            const postUrl = $html.find('form[id=kc-form-login]').attr('action');
            const url = new URL(postUrl);
            cy.request({
              url: url.toString(),
              method: 'POST',
              form: true,
              body: {
                username: username,
                password: password
              }
            }).then(() => {
              const tags = Cypress.env('TAGS');
              if (tags.includes('multi-cluster') || tags.includes('multi-primary')) {
                ensureMulticlusterApplicationsAreHealthy();
              }
            });
          });
        });
      } else if (auth_strategy === 'token') {
        cy.log('Logging in with token auth strategy');
        cy.exec('kubectl -n istio-system create token citest').then(result => {
          cy.request({
            method: 'POST',
            url: 'api/authenticate',
            form: true,
            body: {
              token: result.stdout
            }
          });
        });
      }
    },
    { cacheAcrossSpecs: true }
  );
});

Cypress.Commands.add('getBySel', (selector: string, ...args: any) => cy.get(`[data-test="${selector}"]`, ...args));

Cypress.Commands.add('inputValidation', (id: string, text: string, valid = true) => {
  cy.get(`input[id="${id}"]`).type(text);
  cy.get(`input[id="${id}"]`).should('have.attr', 'aria-invalid', `${!valid}`);
  cy.get(`input[id="${id}"]`).clear();
});

Cypress.Commands.add('hasCssVar', { prevSubject: true }, (subject, styleName, cssVarName) => {
  cy.document().then(doc => {
    const dummy = doc.createElement('span');
    dummy.style.setProperty(styleName, `var(${cssVarName})`);
    doc.body.appendChild(dummy);

    const evaluatedStyle = window.getComputedStyle(dummy).getPropertyValue(styleName).trim();
    dummy.remove();

    cy.wrap(subject)
      .then($el => window.getComputedStyle($el[0]).getPropertyValue(styleName).trim())
      .should('eq', evaluatedStyle);
  });
});
