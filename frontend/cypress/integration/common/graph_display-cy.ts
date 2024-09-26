import { Before, Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';

Before(() => {
  // Copied from overview.ts.  This prevents cypress from stopping on errors unrelated to the tests.
  // There can be random failures due timeouts/loadtime/framework that throw browser errors.  This
  // prevents a CI failure due something like a "slow".  There may be a better way to handle this.
  cy.on('uncaught:exception', (err, runnable, promise) => {
    // when the exception originated from an unhandled promise
    // rejection, the promise is provided as a third argument
    // you can turn off failing the test in this case
    if (promise) {
      return false;
    }
    // we still want to ensure there are no other unexpected
    // errors, so we let them fail the test
  });
});

When(
  'user graphs {string} namespaces with refresh {string} and duration {string} in the cytoscape graph',
  (namespaces: string, refresh: string, duration: string) => {
    cy.visit({
      url: `/console/graph/namespaces?refresh=${refresh}&duration=${duration}&namespaces=${namespaces}`
    });
  }
);

When('user graphs {string} namespaces in the cytoscape graph', (namespaces: string) => {
  // Forcing "Pause" to not cause unhandled promises from the browser when cypress is testing
  cy.intercept(`**/api/namespaces/graph*`).as('graphNamespaces');

  cy.visit({ url: `/console/graph/namespaces?refresh=0&namespaces=${namespaces}` });

  if (namespaces !== '') {
    cy.wait('@graphNamespaces');
  }

  ensureKialiFinishedLoading();
});
