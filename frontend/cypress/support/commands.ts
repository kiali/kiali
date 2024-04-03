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

const getCsrfToken = (response: Cypress.Response<any>): string => {
  const $html = Cypress.$(response.body);
  const csrf = $html.find('input[name=csrf]').val();
  return csrf.toString();
};

// Converts redirects from:
//   302: https://localhost:8080/login?redirect=%2F
// to:
//   https://localhost:8080/login?redirect=%2F
const parseRedirect = (redirect: string): string => {
  return redirect.replace('302: ', '');
};

// finishLogin is only separated because we need to chain off .then
// and this same block is repeated.
const finishLogin = (authEndpoint: string, username: string, password: string, csrf: string): void => {
  const openshiftLoginEndpointURL = new URL(authEndpoint);
  const openshiftLoginEndpoint = openshiftLoginEndpointURL.origin + openshiftLoginEndpointURL.pathname;
  const loginParams = new URLSearchParams(openshiftLoginEndpointURL.search);
  cy.request({
    url: openshiftLoginEndpoint,
    method: 'POST',
    form: true,
    body: {
      username: username,
      password: password,
      then: loginParams.get('then'),
      csrf: csrf
    }
  }).then(resp => {
    const kialiURLWithToken = new URL(resp.redirects.pop().replace('302: ', ''));
    const kialiParams = new URLSearchParams(kialiURLWithToken.hash.slice(1));
    cy.request({
      url: 'api/authenticate',
      body: {
        access_token: kialiParams.get('access_token'),
        expires_in: kialiParams.get('expires_in'),
        scope: kialiParams.get('scope'),
        token_type: kialiParams.get('token_type')
      },
      method: 'POST',
      form: true
    });
  });
};

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
      app => app.name === 'reviews' && app.cluster === 'west' && app.health.requests.inbound.http['200'] > 0
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
  const provider = Cypress.env('AUTH_PROVIDER');

  cy.window().then((win: any) => {
    if (auth_strategy === 'anonymous') {
      cy.log('Skipping login, Kiali is running with auth disabled');
      return;
    }
    cy.log(
      `provider: ${provider},
					username: ${username},
					auth_strategy: ${auth_strategy}`
    );

    if (auth_strategy === 'openshift') {
      if (provider === 'ibmcloud') {
        // This flow comes from: https://cloud.ibm.com/docs/openshift?topic=openshift-access_cluster#access_api_key
        cy.request('api/auth/info').then(({ body }) => {
          const authEndpoint = body.authorizationEndpoint;

          cy.request({
            url: authEndpoint,
            method: 'GET',
            headers: { 'X-CSRF-TOKEN': 'a' },
            auth: { user: 'apikey', pass: password },
            followRedirect: false
          }).then(resp => {
            // cookie automatically set by cypress for the next request.
            const redirectURL = new URL(resp.headers.location as string);

            // Strip first # out of hash.
            const params = new URLSearchParams(redirectURL.hash.slice(1));

            cy.request({
              url: 'api/authenticate',
              method: 'POST',
              followRedirect: false,
              form: true,
              body: {
                access_token: params.get('access_token'),
                expires_in: params.get('expires_in'),
                scope: params.get('scope'),
                token_type: params.get('token_type')
              }
            });
          });
        });
      } else {
        // For all other providers, we assume it's an htpasswd like provider.
        // This covers cases where the provider is htpasswd but named something different.
        //
        // This flow is ripped from the kiali-operator molecule tests:
        // https://github.com/kiali/kiali-operator/blob/master/molecule/openshift-auth-test/converge.yml#L59
        cy.request('api/auth/info').then(({ body }) => {
          let authEndpoint = body.authorizationEndpoint;

          cy.request({
            url: authEndpoint,
            method: 'GET',
            followRedirect: true
          }).then(resp => {
            // If we got redirected, the login endpoint should be the redirect url and not the auth endpoint from the API.
            if (resp.redirects && resp.redirects.length > 0) {
              const csrf = getCsrfToken(resp);
              authEndpoint = parseRedirect(resp.redirects[0]);
              finishLogin(authEndpoint, username, password, csrf);
            } else {
              // If we didn't get redirected, there's multiple providers and we need to choose the provider
              // that was requested by adding it as a query param and then we'll get redirected after login.
              const authEndpointURL = new URL(authEndpoint);
              authEndpointURL.searchParams.set('idp', provider);
              authEndpoint = authEndpointURL.toString();

              cy.request({
                url: authEndpoint,
                method: 'GET',
                followRedirect: true
              }).then(resp => {
                const csrf = getCsrfToken(resp);
                authEndpoint = parseRedirect(resp.redirects[0]);
                finishLogin(authEndpoint, username, password, csrf);
              });
            }
          });
        });
      }
    } else if (auth_strategy === 'openid') {
      // Only works with keycloak at the moment.
      cy.log('Logging in with OpenID');
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
  });
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
