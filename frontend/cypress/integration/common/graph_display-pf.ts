import { Before, Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';
import { Visualization } from '@patternfly/react-topology';
import { elems, select, selectAnd, selectOr } from './graph-pf';
import { EdgeAttr, NodeAttr } from 'types/Graph';

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

When('user graphs {string} namespaces', (namespaces: string) => {
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

Then('the graph reflects default settings', () => {
  cy.waitForReact();
  cy.getReact('GraphPagePFComponent', { state: { isReady: true } })
    .should('have.length', '1')
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { nodes, edges } = elems(controller);

      // no nonDefault edge label info
      let numEdges = selectOr(edges, [
        [{ prop: EdgeAttr.responseTime, op: 'truthy' }],
        [{ prop: EdgeAttr.throughput, op: 'truthy' }]
      ]).length;
      assert.equal(numEdges, 0);

      // no idle edges, mtls
      numEdges = selectOr(edges, [
        [{ prop: EdgeAttr.hasTraffic, op: 'falsy' }],
        [{ prop: EdgeAttr.isMTLS, op: '=', val: undefined }]
      ]).length;
      assert.equal(numEdges, 0);

      // boxes
      let numNodes = select(nodes, { prop: NodeAttr.isBox, op: '=', val: 'app' }).length;
      assert.isAbove(numNodes, 0);
      numNodes = select(nodes, { prop: NodeAttr.isBox, op: '=', val: 'namespace' }).length;
      assert.isAbove(numNodes, 0);

      // service nodes
      numNodes = select(nodes, { prop: NodeAttr.nodeType, op: '=', val: 'service' }).length;
      assert.isAbove(numNodes, 0);

      // a variety of not-found tests
      numNodes = selectOr(nodes, [
        [{ prop: NodeAttr.isBox, op: '=', val: 'cluster' }],
        [{ prop: NodeAttr.isIdle, op: 'truthy' }],
        [{ prop: NodeAttr.rank, op: 'truthy' }],
        [{ prop: NodeAttr.nodeType, op: '=', val: 'operation' }]
      ]).length;
      assert.equal(numNodes, 0);
    });
});

Then('user sees {string} edge labels', (el: string) => {
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
  cy.getReact('GraphPagePFComponent', { state: { isReady: true } })
    .should('have.length', '1')
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { edges } = elems(controller);

      const numEdges = select(edges, { prop: rate, op: '>', val: 0 }).length;
      assert.isAbove(numEdges, 0);
    });
});

Then('user sees {string} edge label option is closed', (edgeLabel: string) => {
  validateInput(edgeLabel, 'does not appear');
});

Then('user does not see {string} boxing', (boxByType: string) => {
  validateInput(`boxBy${boxByType}`, 'does not appear');

  cy.waitForReact();
  cy.getReact('GraphPagePFComponent', { state: { isReady: true } })
    .should('have.length', '1')
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { nodes } = elems(controller);

      const numBoxes = select(nodes, { prop: NodeAttr.isBox, op: '=', val: boxByType.toLowerCase() }).length;
      assert.equal(numBoxes, 0);
    });
});

// In older versions of Istio, when this was written, this istio-system namespace
// would typicaly have some idle edges.  That is no longer the case.  It is not easy
// to force an idle edge to exist, especially in the timeframe of a test, a demo would
// need to generate an edge, then stop, and wait for it to become idle (i.e. at least a
// minute depending on the duration used in the test.) In the future we could possibly
// try to add something like this, but for now I am changing the test to just ensure
// that non-idle edges don't disappear.
Then('idle edges {string} in the graph', (action: string) => {
  validateInput('filterIdleEdges', action);

  cy.waitForReact();

  cy.getReact('GraphPagePFComponent', { state: { isReady: true } })
    .should('have.length', '1')
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { edges } = elems(controller);

      const numEdges = select(edges, { prop: EdgeAttr.hasTraffic, op: '!=', val: undefined }).length;
      const numIdleEdges = select(edges, { prop: EdgeAttr.hasTraffic, op: '=', val: undefined }).length;

      if (action === 'appear') {
        assert.isAbove(numEdges, 0);
        assert.isAtLeast(numIdleEdges, 0);
      } else {
        assert.isAbove(numEdges, 0);
        assert.equal(numIdleEdges, 0);
      }
    });
});

Then('idle nodes {string} in the graph', (action: string) => {
  validateInput('filterIdleNodes', action);

  cy.waitForReact();
  cy.getReact('GraphPagePFComponent', { state: { isReady: true } })
    .should('have.length', '1')
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { nodes } = elems(controller);

      let numNodes = select(nodes, { prop: NodeAttr.isIdle, op: 'truthy' }).length;

      if (action === 'appear') {
        assert.equal(numNodes, 16);
      } else {
        assert.equal(numNodes, 0);
      }
    });
});

Then('ranks {string} in the graph', (action: string) => {
  validateInput('rank', action);

  cy.waitForReact();
  cy.getReact('GraphPagePFComponent', { state: { isReady: true } })
    .should('have.length', '1')
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { nodes } = elems(controller);

      let numNodes = select(nodes, { prop: NodeAttr.rank, op: '>', val: '0' }).length;

      if (action === 'appear') {
        assert.isAbove(numNodes, 0);
      } else {
        assert.equal(numNodes, 0);
      }
    });
});

Then('user does not see service nodes', () => {
  validateInput('filterServiceNodes', 'do not appear');

  cy.waitForReact();
  cy.getReact('GraphPagePFComponent', { state: { isReady: true } })
    .should('have.length', '1')
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { nodes } = elems(controller);

      let numBoxes = selectAnd(nodes, [
        { prop: NodeAttr.nodeType, op: '=', val: 'service' },
        { prop: NodeAttr.isOutside, op: '=', val: undefined }
      ]).length;

      assert.equal(numBoxes, 0);
    });
});

Then('security {string} in the graph', (action: string) => {
  validateInput('filterSecurity', action);

  cy.waitForReact();
  cy.getReact('GraphPagePFComponent', { state: { isReady: true } })
    .should('have.length', '1')
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { edges } = elems(controller);

      let numEdges = select(edges, { prop: EdgeAttr.isMTLS, op: '>', val: 0 }).length;

      if (action === 'appears') {
        assert.isAbove(numEdges, 0);
      } else {
        assert.equal(numEdges, 0);
      }
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

Then('only a single cluster box should be visible', () => {
  cy.waitForReact();
  cy.getReact('GraphPagePFComponent', { state: { isReady: true } })
    .should('have.length', '1')
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { nodes } = elems(controller);

      const clusterBoxes = select(nodes, { prop: NodeAttr.isBox, op: '=', val: 'cluster' }).length;
      assert.equal(clusterBoxes, 0);

      const namespaceBoxes = selectAnd(nodes, [
        { prop: NodeAttr.isBox, op: '=', val: 'namespace' },
        { prop: NodeAttr.namespace, op: '=', val: 'bookinfo' }
      ]).length;
      assert.equal(namespaceBoxes, 1);
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
        expect(response.body).to.have.property('resources');
        expect(response.body.resources['networking.istio.io/v1, Kind=Gateway'].length).greaterThan(0);
        expect(response.body.resources['networking.istio.io/v1, Kind=VirtualService'].length).greaterThan(0);
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
        resp.body.resources['gateway.networking.k8s.io/v1, Kind=Gateway'].length + resp.body.resources['networking.istio.io/v1, Kind=VirtualService'].length + resp.body.resources['networking.istio.io/v1, Kind=DestinationRule'].length;
      cy.get('@istioConfigRequest-west').then(resp => {
        const totalObjectsWest =
          resp.body.resources['gateway.networking.k8s.io/v1, Kind=Gateway'].length + resp.body.resources['networking.istio.io/v1, Kind=VirtualService'].length + resp.body.resources['networking.istio.io/v1, Kind=DestinationRule'].length;
        const totalObjects = totalObjectsEast + totalObjectsWest;
        cy.get('[aria-label="Validations list"]').contains(`Istio config objects analyzed: ${totalObjects}`);
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

Then('{int} edges appear in the graph', (graphEdges: number) => {
  cy.waitForReact();
  ensureKialiFinishedLoading();

  cy.getReact('GraphPagePFComponent', { state: { isReady: true } })
    .should('have.length', '1')
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { edges } = elems(controller);

      const numEdges = select(edges, { prop: EdgeAttr.hasTraffic, op: '!=', val: undefined }).length;
      // It can be more, depending on the service version redirection
      assert.isAtLeast(numEdges, graphEdges);
    });
});

Then('the {string} node {string} exists', (nodeName: string, action: string) => {
  cy.waitForReact();
  cy.getReact('GraphPagePFComponent', { state: { isReady: true } })
    .should('have.length', 1)
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { nodes } = elems(controller);

      const foundNode = nodes.filter(node => node.getData().workload === nodeName);

      if (action === 'does') {
        assert.equal(foundNode.length, 1);
      } else {
        assert.equal(foundNode.length, 0);
      }
    });
});
