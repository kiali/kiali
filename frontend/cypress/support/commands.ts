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
    getBySel(selector: string, ...args: any): Chainable<JQuery<HTMLElement>>;

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

const timeout = 300000; // 5 minutes

function ensureMulticlusterApplicationsAreHealthy(startTime: number): void {
  if (Date.now() - startTime > timeout) {
    cy.log('Timeout reached without meeting the condition.');
    return;
  }

  cy.request(
    'api/namespaces/graph?duration=60s&graphType=versionedApp&appenders=deadNode,istio,serviceEntry,meshCheck,workloadEntry,health&rateGrpc=requests&rateHttp=requests&rateTcp=sent&namespaces=bookinfo'
  ).then(resp => {
    const has_http_200 = resp.body.elements.nodes.some(
      node =>
        node.data.app === 'reviews' &&
        node.data.cluster === 'west' &&
        node.data.nodeType === 'app' &&
        node.data.healthData.requests.inbound.http !== undefined &&
        node.data.healthData.requests.inbound.http['200'] > 0
    );
    if (has_http_200) {
      cy.log("'reviews' app in 'west' cluster is healthy enough.");
    } else {
      cy.log("'reviews' app in 'west' cluster is not healthy yet, checking again in 10 seconds...");
      cy.wait(10000);
      ensureMulticlusterApplicationsAreHealthy(startTime);
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

        cy.intercept('**/api/namespaces').as('getNamespaces');
        cy.intercept('**/api/config').as('getConfig');
        cy.intercept('**/api/status').as('getStatus');
        cy.intercept('**/api/tracing').as('getTracing');
        cy.intercept('**/api/auth/info').as('getAuthInfo');

        cy.visit({ url: '/' });
        const authProvider = Cypress.env('AUTH_PROVIDER');
        if (authProvider !== '' && authProvider !== undefined) {
          cy.contains(authProvider).should('be.visible').click();
        }
        cy.get('#inputUsername').clear().type(username);

        cy.get('#inputPassword').type(password);
        cy.get('button[type="submit"]').click();

        // Wait for post login routes to be loaded. Otherwise cypress redirects you back to the home page
        // which causes other tests to fail: https://github.com/cypress-io/cypress/issues/1713.
        cy.wait('@getNamespaces');
        cy.wait('@getConfig');
        cy.wait('@getStatus');
        cy.wait('@getTracing');
        cy.wait('@getAuthInfo');
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
            const url = new URL(postUrl!);
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
                ensureMulticlusterApplicationsAreHealthy(Date.now());
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
    {
      cacheAcrossSpecs: true,
      validate: () => {
        // For some reason validate is needed to preserve the kiali-token-aes cookie.
        if (auth_strategy === 'openshift' || auth_strategy === 'openid') {
          cy.getCookies()
            .should('exist')
            .and('have.length.at.least', 1)
            .then((cookies: any) => {
              // eslint-disable-next-line @typescript-eslint/no-unused-expressions
              expect(cookies.some(cookie => cookie.name.startsWith('kiali-token'))).to.be.true;
            });
        }
      }
    }
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

// Overrides exec to print out the full output in case of failure.
// https://github.com/cypress-io/cypress/issues/5470.
Cypress.Commands.overwrite('exec', (originalFn, command, options) => {
  // Don't override when failOnNonZeroExit is false because the caller
  // may be doing something else with the output.
  if (options && !options.failOnNonZeroExit) {
    return originalFn(command, options);
  }

  return originalFn(command, { ...options, failOnNonZeroExit: false }).then(result => {
    if (result.code) {
      throw new Error(`Execution of "${command}" failed
      Exit code: ${result.code}
      Stdout:\n${result.stdout}
      Stderr:\n${result.stderr}`);
    }
    return result;
  });
});
