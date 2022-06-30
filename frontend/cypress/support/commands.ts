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
     * @example cy.getBySel('greeting')
     */
    getBySel(selector: string, ...args: any): Chainable<Subject>;

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

    logout(): Chainable<Subject>;
  }
}

let haveCookie = Cypress.env('cookie');

Cypress.Commands.add('login', (username: string, password: string) => {
  cy.log(`auth cookie is: ${haveCookie}`);

  const auth_strategy = Cypress.env('AUTH_STRATEGY');
  const provider = Cypress.env('AUTH_PROVIDER');

  cy.window().then((win: any) => {
    if (auth_strategy !== 'openshift') {
      cy.log('Skipping login, Kiali is running with auth disabled');
      return;
    }

    if (haveCookie === false || haveCookie === undefined) {
      cy.intercept('api/authenticate').as('authorized'); //request setting kiali cookie
      // Cypress.Cookies.debug(true) // now Cypress will log when it alters cookies
      // cy.getCookies()

      cy.log(
        `provider: ${provider},
					username: ${username},
					auth_strategy: ${auth_strategy}`
      );

      if (auth_strategy === 'openshift') {
        if (provider === Cypress.env('AUTH_HTTP_PROVIDER_NAME')) {
          // This flow is ripped from the kiali-operator molecule tests:
          // https://github.com/kiali/kiali-operator/blob/master/molecule/openshift-auth-test/converge.yml#L59
          cy.request('api/auth/info').then(({ body }) => {
            const authEndpoint = body.authorizationEndpoint;
            cy.request({
              url: authEndpoint,
              method: 'GET',
              followRedirect: false
            }).then(resp => {
              const auth2Endpoint = resp.redirectedToUrl!;
              cy.request({
                url: auth2Endpoint,
                method: 'GET',
                followRedirect: false
              }).then(() => {
                const openshiftLoginEndpointURL = new URL(auth2Endpoint);
                const openshiftLoginEndpoint = openshiftLoginEndpointURL.origin + openshiftLoginEndpointURL.pathname;
                const loginParams = new URLSearchParams(openshiftLoginEndpointURL.search);
                cy.getCookie('csrf').then(cookie => {
                  cy.request({
                    url: openshiftLoginEndpoint,
                    method: 'POST',
                    form: true,
                    body: {
                      username: username,
                      password: password,
                      then: loginParams.get('then'),
                      csrf: cookie.value
                    }
                  }).then(resp => {
                    const kialiURLWithToken = new URL(resp.redirects[1].replace('302: ', ''));
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
                });
              });
            });
          });
        } else if (provider === 'ibmcloud') {
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
        }

        cy.getCookie('kiali-token-aes', { timeout: 15000 })
          .should('exist')
          .then(() => {
            haveCookie = true;
          });
      }
    } else {
      cy.log('got an auth cookie, skipping login');
    }
  });
});

Cypress.Commands.add('getBySel', (selector: string, ...args) => cy.get(`[data-test="${selector}"]`, ...args));
