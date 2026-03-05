import { buildNodeTree, findComponentsInTree, getReactFiber, isReactRoot, ReactNode, ReactOpts } from './react-utils';

// ***********************************************
// Custom Cypress commands for Kiali testing.
// https://on.cypress.io/custom-commands
// ***********************************************

declare global {
  interface Window {
    __REACT_LOADED__?: boolean;
    __REACT_ROOT_FIBER__?: any;
  }

  namespace Cypress {
    interface Chainable<Subject> {
      /**
       * Custom command to select DOM element by the 'data-test' attribute.
       * @param selector the DOM element selector
       * @param args the rest of DOM element args
       * @example cy.getBySel('greeting')
       */
      getBySel(selector: string, ...args: any): Chainable<JQuery<HTMLElement>>;

      /**
       * Get the current state of a React component.
       * Must be chained from a ReactNode (from getReact).
       * @example cy.getReact('MyComponent').then(c => c[0]).getCurrentState()
       */
      getCurrentState(): Chainable<any>;

      /**
       * Get props from a React component. Optionally get a specific prop by name.
       * Must be chained from a ReactNode (from getReact).
       * @param propName - Optional name of specific prop to retrieve
       * @example cy.getReact('MyComponent').then(c => c[0]).getProps()
       * @example cy.getReact('MyComponent').then(c => c[0]).getProps('onClick')
       */
      getProps(propName?: string): Chainable<any>;

      /**
       * Get React components by component name, props, and/or state.
       * Compatible with React 16, 17, and 18.
       * @param componentName - Name of the React component (supports wildcards like *oint)
       * @param reactOpts - Options to filter by props, state, etc.
       * @example cy.getReact('MyComponent')
       * @example cy.getReact('GraphPageComponent', { state: { isReady: true } })
       * @example cy.getReact('Button', { props: { disabled: false } })
       */
      getReact(componentName: string, reactOpts?: ReactOpts): Chainable<ReactNode[]>;

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

      /**
       * Get the nth element from an array of React nodes.
       * @param index - The index of the element to get
       * @example cy.getReact('MyComponent').nthNode(0)
       */
      nthNode(index: number): Chainable<ReactNode>;

      /**
       * Wait for React to be loaded on the page.
       * Compatible with React 16, 17, and 18.
       * @param timeout - Maximum time to wait in milliseconds (default: 30000)
       * @param reactRoot - CSS selector for React root element (default: '#root')
       * @example cy.waitForReact()
       * @example cy.waitForReact(60000, '#app')
       */
      waitForReact(timeout?: number, reactRoot?: string): Chainable<void>;
    }
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
      (node: any) =>
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
        // Make an API request that returns a 200 only when logged in
        cy.request({ url: '/api/status' }).its('status').should('eq', 200);
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
// This is necessary because cypress truncates the output of stdout/stderr.
// See https://github.com/cypress-io/cypress/issues/5470 for more details.
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

Cypress.Commands.add('waitForReact', (waitTimeout = 30000, reactRoot?: string) => {
  const checkInterval = 200;
  const startTime = Date.now();

  // Use provided root, or configured rootSelector, or body as fallback
  const rootSelector = reactRoot || Cypress.env('rootSelector') || 'body';

  cy.log(`Waiting for page to be ready (root: ${rootSelector})...`);

  const waitForRoot = (): void => {
    cy.document({ log: false }).then(doc => {
      const rootEl = doc.querySelector(rootSelector);

      if (rootEl && isReactRoot(rootEl)) {
        const fiber = getReactFiber(rootEl);
        if (fiber) {
          cy.window({ log: false }).then((win: Window) => {
            win.__REACT_ROOT_FIBER__ = fiber;
            win.__REACT_LOADED__ = true;
          });
          cy.log(`Page ready (React root found at "${rootSelector}")`);
          return;
        }
      }

      // Fallback: just check if page has rendered content
      const hasContent = doc.body && doc.body.children.length > 0;
      if (hasContent && Date.now() - startTime > 5000) {
        cy.window({ log: false }).then((win: Window) => {
          win.__REACT_LOADED__ = true;
        });
        cy.log('Page ready (content loaded)');
        return;
      }

      if (Date.now() - startTime > waitTimeout) {
        cy.window({ log: false }).then((win: Window) => {
          win.__REACT_LOADED__ = true;
        });
        cy.log('Page ready (timeout reached, proceeding)');
        return;
      }

      cy.wait(checkInterval, { log: false }).then(() => waitForRoot());
    });
  };

  waitForRoot();
});

Cypress.Commands.add('getReact', (componentName: string, reactOpts: ReactOpts = {}) => {
  const cmdTimeout = reactOpts.options?.timeout || Cypress.config('defaultCommandTimeout');
  const checkInterval = 100;
  let retries = Math.floor(cmdTimeout / checkInterval);

  cy.log(`Finding React component: ${componentName}`);

  const findComponents = (): Cypress.Chainable<ReactNode[]> => {
    return cy.window({ log: false }).then((win: Window) => {
      if (!win.__REACT_LOADED__) {
        throw new Error('getReact: React not loaded. Did you call cy.waitForReact()?');
      }

      const rootFiber = win.__REACT_ROOT_FIBER__;
      if (!rootFiber) {
        throw new Error('getReact: React fiber root not found');
      }

      const tree = buildNodeTree(rootFiber);
      return findComponentsInTree(tree, componentName, reactOpts);
    });
  };

  const resolveValue = (): Cypress.Chainable<any> => {
    return findComponents().then(results => {
      if (results.length > 0) {
        return cy.wrap(results);
      }

      if (retries < 1) {
        cy.log(`Component "${componentName}" not found`);
        return cy.wrap([]);
      }

      retries--;
      return cy.wait(checkInterval, { log: false }).then(() => resolveValue());
    });
  };

  return resolveValue();
});

// Get the current state of a React component (child command)
Cypress.Commands.add('getCurrentState', { prevSubject: true }, (subject: ReactNode) => {
  if (!subject || typeof subject !== 'object') {
    throw new Error('getCurrentState: subject must be a ReactNode object');
  }

  cy.log('Getting current state');
  return cy.wrap(subject.state);
});

// Get props from a React component (child command)
Cypress.Commands.add('getProps', { prevSubject: true }, (subject: ReactNode, propName?: string) => {
  if (!subject || typeof subject !== 'object') {
    throw new Error('getProps: subject must be a ReactNode object');
  }

  cy.log(`Getting props${propName ? `: ${propName}` : ''}`);

  if (propName) {
    return cy.wrap(subject.props?.[propName]);
  }
  return cy.wrap(subject.props);
});

// Get the nth element from an array of React nodes (child command)
Cypress.Commands.add('nthNode', { prevSubject: true }, (subject: ReactNode[], index: number) => {
  if (!Array.isArray(subject)) {
    throw new Error('nthNode: subject must be an array of ReactNode objects');
  }

  cy.log(`Getting node at index ${index}`);
  return cy.wrap(subject[index]);
});
