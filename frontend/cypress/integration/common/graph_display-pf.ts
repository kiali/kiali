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

When('user graphs {string} namespaces in the patternfly graph', (namespaces: string) => {
  // Forcing "Pause" to not cause unhandled promises from the browser when cypress is testing
  cy.intercept(`**/api/namespaces/graph*`).as('graphNamespaces');

  cy.visit({ url: `/console/graphpf/namespaces?refresh=0&namespaces=${namespaces}` });

  if (namespaces !== '') {
    cy.wait('@graphNamespaces');
  }

  ensureKialiFinishedLoading();
});

When('user opens display menu', () => {
  cy.get('button#display-settings').click();
});

When('user enables {string} {string} edge labels', (radio: string, edgeLabel: string) => {
  cy.get('div#graph-display-menu').find(`input#${edgeLabel}`).check();
  cy.get(`input#${radio}`).check();
});

When('user {string} {string} edge labels', (action: string, edgeLabel: string) => {
  if (action === 'enables') {
    cy.get('div#graph-display-menu').find(`input#${edgeLabel}`).check();
  } else {
    cy.get('div#graph-display-menu').find(`input#${edgeLabel}`).uncheck();
  }
});

When('user {string} {string} option', (action: string, option: string) => {
  switch (option.toLowerCase()) {
    case 'cluster boxes':
      option = 'boxByCluster';
      break;
    case 'idle edges':
      option = 'filterIdleEdges';
      break;
    case 'idle nodes':
      option = 'filterIdleNodes';
      break;
    case 'missing sidecars':
      option = 'filterSidecars';
      break;
    case 'namespace boxes':
      option = 'boxByNamespace';
      break;
    case 'operation nodes':
      option = 'filterOperationNodes';
      break;
    case 'rank':
      option = 'rank';
      break;
    case 'service nodes':
      option = 'filterServiceNodes';
      break;
    case 'security':
      option = 'filterSecurity';
      break;
    case 'traffic animation':
      option = 'filterTrafficAnimation';
      break;
    case 'virtual services':
      option = 'filterVS';
      break;
    default:
      option = 'xxx';
  }

  if (action === 'enables') {
    cy.get('div#graph-display-menu').find(`input#${option}`).check();

    if (option === 'rank') {
      cy.get(`input#inboundEdges`).check();
    }
  } else {
    cy.get('div#graph-display-menu').find(`input#${option}`).uncheck();
  }
});

When('user resets to factory default', () => {
  cy.get('button#graph-factory-reset').click();
  cy.get('#loading_kiali_spinner').should('not.exist');
});

///////////////////

Then(`user sees no namespace selected`, () => {
  cy.get('div#empty-graph-no-namespace').should('be.visible');
});

Then(`user sees empty graph`, () => {
  cy.get('div#empty-graph').should('be.visible');
});

Then(`user sees the {string} namespace`, ns => {
  cy.get('div#summary-panel-graph').find('div#summary-panel-graph-heading').find(`div#ns-${ns}`).should('be.visible');
});

Then('the display menu opens', () => {
  cy.get('button#display-settings').invoke('attr', 'aria-expanded').should('eq', 'true');
  cy.get('div#graph-display-menu').should('exist');
});

Then('the display menu has default settings', () => {
  cy.get('div#graph-display-menu').within(() => {
    cy.get(`input#responseTime`).should('exist').should('not.be.checked');
    cy.get(`input#throughput`).should('exist').should('not.be.checked');
    cy.get(`input#trafficDistribution`).should('exist').should('not.be.checked');
    cy.get(`input#trafficRate`).should('exist').should('not.be.checked');
    cy.get(`input#boxByCluster`).should('exist').should('be.checked');
    cy.get(`input#boxByNamespace`).should('exist').should('be.checked');
    cy.get(`input#filterIdleEdges`).should('exist').should('not.be.checked');
    cy.get(`input#filterIdleNodes`).should('exist').should('not.be.checked');
    cy.get(`input#filterOperationNodes`).should('exist').should('not.be.checked');
    cy.get(`input#rank`).should('exist').should('not.be.checked');
    cy.get(`input#filterServiceNodes`).should('exist').should('be.checked');
    cy.get(`input#filterTrafficAnimation`).should('exist').should('not.be.checked');
    cy.get(`input#filterSidecars`).should('exist').should('be.checked');
    cy.get(`input#filterSecurity`).should('exist').should('not.be.checked');
    cy.get(`input#filterVS`).should('exist').should('be.checked');
  });
});

Then('the patternfly graph reflects default settings', () => {
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

Then('user sees {string} edge labels in the patternfly graph', (el: string) => {
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

Then('user sees {string} edge label option is closed', (edgeLabel: string) => {
  validateInput(edgeLabel, 'does not appear');
});

Then('user does not see {string} boxing in the patternfly graph', (boxByType: string) => {
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
Then('idle edges {string} in the patternfly graph', (action: string) => {
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

Then('idle nodes {string} in the patternfly graph', (action: string) => {
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

Then('ranks {string} in the patternfly graph', (action: string) => {
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

Then('user does not see service nodes in the patternfly graph', () => {
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

Then('security {string} in the patternfly graph', (action: string) => {
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

Then('{string} option {string} in the graph', (option: string, action: string) => {
  switch (option.toLowerCase()) {
    case 'missing sidecars':
      option = 'filterSidecars';
      break;
    case 'traffic animation':
      option = 'filterTrafficAnimation';
      break;
    case 'virtual services':
      option = 'filterVS';
      break;
    default:
      option = 'xxx';
  }

  validateInput(option, action);
});

Then('the {string} option should {string} and {string}', (option: string, optionState: string, checkState: string) => {
  switch (option) {
    case 'operation nodes':
      option = 'filterOperationNodes';
      break;
    case 'service nodes':
      option = 'filterServiceNodes';
      break;
    default:
      option = 'xxx';
  }

  cy.get('div#graph-display-menu')
    .find(`input#${option}`)
    .should(optionState.replaceAll(' ', '.'))
    .and(`be.${checkState}`);
});

Then('only a single cluster box should be visible in the patternfly graph', () => {
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

Given(
  'there are Istio objects in the {string} namespace for {string} cluster',
  (namespace: string, cluster: string) => {
    // From test setup there should be at least a "bookinfo" VirtualService and a "bookinfo-gateway" Gateway in each cluster.
    cy.request({ url: `api/namespaces/${namespace}/istio`, qs: { clusterName: cluster } })
      .as(`istioConfigRequest-${cluster}`)
      .then(response => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('gateways');
        expect(response.body).to.have.property('virtualServices');
        expect(response.body.gateways).to.have.length.gte(1);
        expect(response.body.virtualServices).to.have.length.gte(1);
      });
  }
);

Then(
  'the Istio objects for the {string} namespace for both clusters should be grouped together in the panel',
  (namespace: string) => {
    cy.get('#graph-side-panel')
      .find(`#ns-${namespace}`)
      .within($ns => {
        // rightClick simiulates 'hover' since support for this is wonky in cypress: https://github.com/cypress-io/cypress/issues/10
        cy.get(
          ':is([data-test="icon-correct-validation"], [data-test="icon-warning-validation"], [data-test="icon-error-validation"])'
        ).rightclick();
      });

    cy.get('@istioConfigRequest-east').then(resp => {
      // Not going to check all the objects. Just the ones that probably exist while testing.
      const totalObjectsEast =
        resp.body.gateways.length + resp.body.virtualServices.length + resp.body.destinationRules.length;
      cy.get('@istioConfigRequest-west').then(resp => {
        const totalObjectsWest =
          resp.body.gateways.length + resp.body.virtualServices.length + resp.body.destinationRules.length;
        const totalObjects = totalObjectsEast + totalObjectsWest;
        cy.get('[aria-label="Validations list"]').contains(`Istio config objects analyzed: ${totalObjects}`);
      });
    });
  }
);
Then(
  'user double-clicks on the {string} {string} from the {string} cluster in the main patternfly graph',
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

When('user opens traffic menu', () => {
  cy.get('button#graph-traffic-dropdown').click();
});

When('user {string} {string} traffic option', (action: string, option: string) => {
  if (action === 'enables') {
    cy.get('div#graph-traffic-menu').find(`input#${option}`).check();
  } else {
    cy.get('div#graph-traffic-menu').find(`input#${option}`).uncheck();
  }
});

Then('{int} edges appear in the patternfly graph', (edges: number) => {
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
