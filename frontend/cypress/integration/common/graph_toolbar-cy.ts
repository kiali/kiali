import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { CytoscapeGlobalScratchData, CytoscapeGlobalScratchNamespace } from 'types/Graph';

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
