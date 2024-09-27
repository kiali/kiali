import { Before, Then, When } from '@badeball/cypress-cucumber-preprocessor';
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

When('user graphs {string} namespaces in the cytoscape graph', (namespaces: string) => {
  // Forcing "Pause" to not cause unhandled promises from the browser when cypress is testing
  cy.intercept(`**/api/namespaces/graph*`).as('graphNamespaces');

  cy.visit({ url: `/console/graph/namespaces?refresh=0&namespaces=${namespaces}` });

  if (namespaces !== '') {
    cy.wait('@graphNamespaces');
  }

  ensureKialiFinishedLoading();
});

Then('the cytoscape graph reflects default settings', () => {
  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
    .should('have.length', '1')
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          // no nonDefault edge label info
          let numEdges = state.cy.edges(`[?responseTime],[?throughput]`).length;
          assert.equal(numEdges, 0);

          // no idle edges, mtls
          numEdges = state.cy.edges(`[^hasTraffic],[isMTLS > 0]`).length;
          assert.equal(numEdges, 0);

          // boxes
          let numNodes = state.cy.nodes(`[isBox = "app"]`).length;
          assert.isAbove(numNodes, 0);
          numNodes = state.cy.nodes(`[isBox = "namespace"]`).length;
          assert.isAbove(numNodes, 0);

          // service nodes
          numNodes = state.cy.nodes(`[nodeType = "service"]`).length;
          assert.isAbove(numNodes, 0);

          // a variety of not-found tests
          numNodes = state.cy.nodes(`[isBox = "cluster"],[?isIdle],[?rank],[nodeType = "operation"]`).length;
          assert.equal(numNodes, 0);
        });
    });
});

Then('user sees {string} edge labels in the cytoscape graph', (el: string) => {
  validateInput(el, 'appear');

  let rate: string;
  switch (el) {
    case 'trafficDistribution':
      rate = 'httpPercentReq';
      break;
    case 'trafficRate':
      rate = 'http';
      break;
    default:
      rate = el;
  }

  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
    .should('have.length', '1')
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          const numEdges = state.cy.edges(`[${rate}" > 0]`).length;
          assert.isAbove(numEdges, 0);
        });
    });
});

Then('user does not see {string} boxing in the cytoscape graph', (boxByType: string) => {
  validateInput(`boxBy${boxByType}`, 'does not appear');

  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
    .should('have.length', '1')
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          const numBoxes = state.cy.nodes(`[isBox = "${boxByType.toLowerCase()}"]`).length;
          assert.equal(numBoxes, 0);
        });
    });
});

// In older versions of Istio, when this was written, this istio-system namespace
// would typicaly have some idle edges.  That is no longer the case.  It is not easy
// to force an idle edge to exist, especially in the timeframe of a test, a demo would
// need to generate an edge, then stop, and wait for it to become idle (i.e. at least a
// minute depending on the duration used in the test.) In the future we could possibly
// try to add something like this, but for now I am changing the test to just ensure
// that non-idle edges don't disappear.
Then('idle edges {string} in the cytoscape graph', (action: string) => {
  validateInput('filterIdleEdges', action);

  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
    .should('have.length', '1')
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          const numEdges = state.cy.edges(`[hasTraffic]`).length;
          const numIdleEdges = state.cy.edges(`[^hasTraffic]`).length;

          if (action === 'appear') {
            assert.isAbove(numEdges, 0);
            assert.isAtLeast(numIdleEdges, 0);
          } else {
            assert.isAbove(numEdges, 0);
            assert.equal(numIdleEdges, 0);
          }
        });
    });
});

Then('idle nodes {string} in the cytoscape graph', (action: string) => {
  validateInput('filterIdleNodes', action);

  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
    .should('have.length', '1')
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          const numNodes = state.cy.nodes(`[?isIdle]`).length;
          if (action === 'appear') {
            assert.equal(numNodes, 16);
          } else {
            assert.equal(numNodes, 0);
          }
        });
    });
});

Then('ranks {string} in the cytoscape graph', (action: string) => {
  validateInput('rank', action);

  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
    .should('have.length', '1')
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          const numNodes = state.cy.nodes(`[rank > 0]`).length;
          if (action === 'appear') {
            assert.isAbove(numNodes, 0);
          } else {
            assert.equal(numNodes, 0);
          }
        });
    });
});

Then('user does not see service nodes in the cytoscape graph', () => {
  validateInput('filterServiceNodes', 'do not appear');

  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
    .should('have.length', '1')
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          const numBoxes = state.cy.nodes(`[nodeType = "service"][^isOutside]`).length;
          assert.equal(numBoxes, 0);
        });
    });
});

Then('security {string} in the cytoscape graph', (action: string) => {
  validateInput('filterSecurity', action);

  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
    .should('have.length', '1')
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          const numEdges = state.cy.edges(`[isMTLS > 0]`).length;
          if (action === 'appears') {
            assert.isAbove(numEdges, 0);
          } else {
            assert.equal(numEdges, 0);
          }
        });
    });
});

Then('only a single cluster box should be visible in the cytoscape graph', () => {
  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
    .should('have.length', '1')
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          const clusterBoxes = state.cy.nodes(`[isBox = "cluster"]`).length;
          assert.equal(clusterBoxes, 0);

          const namespaceBoxes = state.cy.nodes(`[isBox = "namespace"][namespace = "bookinfo"]`).length;
          assert.equal(namespaceBoxes, 1);
        });
    });
});

const validateInput = (option: string, action: string): void => {
  if (action.startsWith('appear')) {
    cy.get('div#graph-display-menu')
      .find(`input#${option}`)
      .should('exist')
      .should('be.checked')
      .should('not.be.disabled'); // this forces a wait, enables when graph is refreshed
  } else {
    cy.get('div#graph-display-menu')
      .find(`input#${option}`)
      .should('exist')
      .should('not.be.checked')
      .should('not.be.disabled'); // this forces a wait, enables when graph is refreshed
  }
};

Then(
  'user double-clicks on the {string} {string} from the {string} cluster in the main cytoscape graph',
  (name: string, type: string, cluster: string) => {
    cy.waitForReact();
    cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
      .should('have.length', '1')
      .then(() => {
        cy.getReact('CytoscapeGraph')
          .should('have.length', '1')
          .getCurrentState()
          .then(state => {
            let node;
            if (type === 'app') {
              node = state.cy.nodes(`[app="${name}"][cluster="${cluster}"][isBox="app"]`);
            } else if (type === 'service') {
              node = state.cy.nodes(`[nodeType="service"][cluster="${cluster}"][app="${name}"]`);
            }
            // none of the standard cytoscape.js events for double-clicks were not working unfortunately
            node.emit('tap');
            node.emit('tap');
          });
      });
  }
);

Then('{int} edges appear in the cytoscape graph', (edges: number) => {
  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
    .should('have.length', '1')
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          const numEdges = state.cy.edges(`[hasTraffic]`).length;
          // It can be more, depending on the service version redirection
          assert.isAtLeast(numEdges, edges);
        });
    });
});
