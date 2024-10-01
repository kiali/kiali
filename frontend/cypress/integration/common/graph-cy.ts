/*
  This file contains graph related step definitions
  that are common to multiple features.
*/

import { Then } from '@badeball/cypress-cucumber-preprocessor';

Then('user does not see a cytoscape minigraph', () => {
  cy.get('#MiniGraphCard').find('h5').contains('Empty Graph');
});

Then('user sees a cytoscape minigraph', () => {
  cy.getBySel('mini-graph').within(() => {
    cy.get('#cytoscape-graph').should('be.visible');
    cy.get('#cy').should('be.visible');
  });
});

Then(
  'user sees the {string} namespace deployed across the east and west clusters in the cytoscape graph',
  (namespace: string) => {
    cy.waitForReact();
    cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
      .should('have.length', '1')
      .then(() => {
        cy.getReact('CytoscapeGraph')
          .should('have.length', '1')
          .getCurrentState()
          .then(state => {
            const namespaceBoxes = state.cy
              .nodes()
              .filter(node => node.data('isBox') === 'namespace' && node.data('namespace') === namespace);
            expect(namespaceBoxes.length).to.equal(2);
            expect(namespaceBoxes.filter(node => node.data('cluster') === 'east').length).to.equal(1);
            expect(namespaceBoxes.filter(node => node.data('cluster') === 'west').length).to.equal(1);
          });
      });
  }
);

Then(
  'nodes in the {string} cluster in the cytoscape graph should contain the cluster name in their links',
  (cluster: string) => {
    cy.waitForReact();
    cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
      .should('have.length', '1')
      .then(() => {
        cy.getReact('CytoscapeGraph')
          .should('have.length', '1')
          .getCurrentState()
          .then(state => {
            const nodes = state.cy.nodes().filter(node => node.data('cluster') === cluster);
            nodes.forEach(node => {
              const links = node.connectedEdges().filter(edge => edge.data('source') === node.id());
              links.forEach(link => {
                const sourceNode = nodes.toArray().find(node => node.id() === link.data('source'));
                expect(sourceNode.data('cluster')).to.equal(cluster);
              });
            });
          });
      });
  }
);

Then(
  'user clicks on the {string} workload in the {string} namespace in the {string} cluster in the cytoscape graph',
  (workload: string, namespace: string, cluster: string) => {
    cy.waitForReact();
    cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
      .should('have.length', '1')
      .then(() => {
        cy.getReact('CytoscapeGraph')
          .should('have.length', '1')
          .getCurrentState()
          .then(state => {
            const workloadNode = state.cy.nodes().filter(
              node =>
                // Apparently workloads are apps for the versioned app graph.
                node.data('nodeType') === 'app' &&
                node.data('isBox') === undefined &&
                node.data('workload') === workload &&
                node.data('namespace') === namespace &&
                node.data('cluster') === cluster
            );
            expect(workloadNode.length).to.equal(1);
            cy.wrap(workloadNode.emit('tap')).then(() => {
              // Wait for the side panel to change.
              // Note we can't use summary-graph-panel since that
              // element will get unmounted and disappear when
              // the context changes but the graph-side-panel does not.
              cy.get('#graph-side-panel').contains(workload);
            });
          });
      });
  }
);
