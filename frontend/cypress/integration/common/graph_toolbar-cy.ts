import { Before, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { CytoscapeGlobalScratchData, CytoscapeGlobalScratchNamespace } from 'types/Graph';

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

Then('user {string} {string} traffic in the cytoscape graph', (action: string, protocol: string) => {
  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
    .should('have.length', '1')
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          const numEdges = state.cy.edges(`[protocol = "${protocol}"]`).length;

          if (action === 'sees') {
            assert.isAbove(numEdges, 0);
          } else {
            assert.equal(numEdges, 0);
          }
        });
    });
});

Then('user sees a {string} cytoscape graph', graphType => {
  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
    .should('have.length', '1')
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          const globalScratch: CytoscapeGlobalScratchData = state.cy.scratch(CytoscapeGlobalScratchNamespace);
          assert.equal(globalScratch.graphType, graphType);
        });
    });
});
