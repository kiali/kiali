import { Given, Step, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { nodeInfo } from './graph-pf';

Then(
  'user sees {string} from a remote {string} cluster in the cytoscape minigraph',
  (type: string, cluster: string) => {
    cy.waitForReact();
    cy.getReact('CytoscapeGraph')
      .should('have.length', '1')
      .getCurrentState()
      .then(state => {
        const apps = state.cy.nodes(`[cluster="${cluster}"][nodeType="${type}"][namespace="bookinfo"]`).length;
        assert.isAbove(apps, 0);
      });
  }
);

// And user clicks on the "reviews" <type> from the "west" cluster visible in the graph
Given(
  'the {string} {string} from the {string} cluster is visible in the cytoscape minigraph',
  (name: string, type: string, cluster: string) => {
    Step(this, 'user sees a cytoscape minigraph');
    cy.waitForReact();
    cy.getReact('CytoscapeGraph')
      .should('have.length', '1')
      .then($graph => {
        cy.wrap($graph)
          .getProps()
          .then(props => {
            const graphType = props.graphData.fetchParams.graphType;
            const { nodeType, isBox } = nodeInfo(type, graphType);
            cy.wrap($graph)
              .getCurrentState()
              .then(state => {
                cy.wrap(
                  state.cy
                    .nodes()
                    .some(
                      node =>
                        node.data('nodeType') === nodeType &&
                        node.data('namespace') === 'bookinfo' &&
                        node.data(type) === name &&
                        node.data('cluster') === cluster &&
                        node.data('isBox') === isBox
                    )
                ).should('be.true');
              });
          });
      });
  }
);

When(
  'user clicks on the {string} {string} from the {string} cluster in the cytoscape minigraph',
  (name: string, type: string, cluster: string) => {
    cy.waitForReact();
    cy.getReact('CytoscapeGraph')
      .should('have.length', '1')
      .then($graph => {
        cy.wrap($graph)
          .getProps()
          .then(props => {
            const graphType = props.graphData.fetchParams.graphType;
            cy.wrap($graph)
              .getCurrentState()
              .then(state => {
                const node = state.cy
                  .nodes()
                  .toArray()
                  .find(node => {
                    const { nodeType, isBox } = nodeInfo(type, graphType);
                    return (
                      node.data('nodeType') === nodeType &&
                      node.data('namespace') === 'bookinfo' &&
                      node.data(type) === name &&
                      node.data('cluster') === cluster &&
                      node.data('isBox') === isBox &&
                      !node.data('isInaccessible')
                    );
                  });
                node.emit('tap');
              });
          });
      });
  }
);
