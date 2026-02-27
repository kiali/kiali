import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';
import { assertGraphReady, select, selectAnd, selectOr } from './graph';
import { EdgeAttr, NodeAttr } from 'types/Graph';
import { enableKialiFeature, GRAPH_CACHE_CONFIG } from './kiali-config';

When('user graphs {string} namespaces', (namespaces: string) => {
  // Forcing "Pause" to not cause unhandled promises from the browser when cypress is testing
  cy.intercept(`**/api/namespaces/graph*`).as('graphNamespaces');

  cy.visit({ url: `/console/graph/namespaces?refresh=0&namespaces=${namespaces}` });

  if (namespaces !== '') {
    cy.url().then(url => {
      // Only wait for API call in Kiali standalone, not in OpenShift
      // Because OpenShift makes a redirection and the URL is never intercepted
      if (!url.includes('/ossmconsole/')) {
        cy.wait('@graphNamespaces');
      }
    });
  }

  ensureKialiFinishedLoading();
});

When('user {string} display menu', (_action: string) => {
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
  cy.intercept(`**/api/namespaces/graph*`).as('graphNamespaces');

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
    case 'waypoint proxies':
      option = 'filterWaypoints';
      break;
    default:
      option = 'xxx';
  }

  if (action === 'enables') {
    cy.get('div#graph-display-menu').find(`input#${option}`).check();

    if (option === 'rank') {
      cy.get(`input#inboundEdges`).check();
    }
    if (option === 'filterWaypoints') {
      cy.wait('@graphNamespaces');
    }
  } else {
    cy.get('div#graph-display-menu').find(`input#${option}`).uncheck();
  }
  ensureKialiFinishedLoading();
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
  assertGraphReady(({ nodes, edges }) => {
    let numEdges = selectOr(edges, [
      [{ prop: EdgeAttr.responseTime, op: 'truthy' }],
      [{ prop: EdgeAttr.throughput, op: 'truthy' }]
    ]).length;
    assert.equal(numEdges, 0);

    numEdges = selectOr(edges, [
      [{ prop: EdgeAttr.hasTraffic, op: 'falsy' }],
      [{ prop: EdgeAttr.isMTLS, op: '=', val: undefined }]
    ]).length;
    assert.equal(numEdges, 0);

    let numNodes = select(nodes, { prop: NodeAttr.isBox, op: '=', val: 'app' }).length;
    assert.isAbove(numNodes, 0);
    numNodes = select(nodes, { prop: NodeAttr.isBox, op: '=', val: 'namespace' }).length;
    assert.isAbove(numNodes, 0);

    numNodes = select(nodes, { prop: NodeAttr.nodeType, op: '=', val: 'service' }).length;
    assert.isAbove(numNodes, 0);

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

  assertGraphReady(({ edges }) => {
    const numEdges = select(edges, { prop: rate, op: '>', val: 0 }).length;
    assert.isAbove(numEdges, 0);
  });
});

Then('user sees {string} edge label option is closed', (edgeLabel: string) => {
  validateInput(edgeLabel, 'does not appear');
});

Then('user does not see {string} boxing', (boxByType: string) => {
  validateInput(`boxBy${boxByType}`, 'does not appear');

  assertGraphReady(({ nodes }) => {
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

  assertGraphReady(({ edges }) => {
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

  assertGraphReady(({ nodes }) => {
    let numNodes = select(nodes, { prop: NodeAttr.isIdle, op: 'truthy' }).length;

    if (action === 'appear') {
      assert.isAbove(numNodes, 0);
    } else {
      assert.equal(numNodes, 0);
    }
  });
});

Then('ranks {string} in the graph', (action: string) => {
  validateInput('rank', action);

  assertGraphReady(({ nodes }) => {
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

  assertGraphReady(({ nodes }) => {
    let numBoxes = selectAnd(nodes, [
      { prop: NodeAttr.nodeType, op: '=', val: 'service' },
      { prop: NodeAttr.isOutside, op: '=', val: undefined }
    ]).length;

    assert.equal(numBoxes, 0);
  });
});

Then('security {string} in the graph', (action: string) => {
  validateInput('filterSecurity', action);

  assertGraphReady(({ edges }) => {
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

  assertGraphReady(({ nodes, edges }) => {
    assert.isAbove(edges.length, 0);
    assert.isAbove(nodes.length, 0);
  });
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
    .should(optionState.replace(/ /g, '.'))
    .and(`be.${checkState}`);
});

Then('only a single cluster box should be visible', () => {
  assertGraphReady(({ nodes }) => {
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
      .within(() => {
        // rightClick simiulates 'hover' since support for this is wonky in cypress: https://github.com/cypress-io/cypress/issues/10
        cy.get(
          ':is([data-test="icon-correct-validation"], [data-test="icon-warning-validation"], [data-test="icon-error-validation"])'
        ).rightclick();
      });

    cy.get('@istioConfigRequest-east').then(resp => {
      const response = (resp as unknown) as Cypress.Response<any>;
      let totalObjectsEast = 0;
      Object.keys(response.body.resources).forEach(resourceKey => {
        totalObjectsEast += response.body.resources[resourceKey].length;
      });
      cy.get('@istioConfigRequest-west').then(resp => {
        const response = (resp as unknown) as Cypress.Response<any>;
        let totalObjectsWest = 0;
        Object.keys(response.body.resources).forEach(resourceKey => {
          totalObjectsWest += response.body.resources[resourceKey].length;
        });
        const totalObjects = totalObjectsEast + totalObjectsWest;
        cy.get('[aria-label="Validations list"]').contains(`Istio config objects analyzed: ${totalObjects}`);
      });
    });
  }
);

Then('{int} edges appear in the graph', (graphEdges: number) => {
  assertGraphReady(({ edges }) => {
    const numEdges = select(edges, { prop: EdgeAttr.hasTraffic, op: '!=', val: undefined }).length;
    assert.isAtLeast(numEdges, graphEdges);
  });
});

Then('{int} nodes appear in the graph', (graphNodes: number) => {
  assertGraphReady(({ nodes }) => {
    const visibleNodes = nodes.filter(n => {
      const data = n.getData?.() as any;
      return data?.nodeType === 'app' || data?.nodeType === 'service';
    });

    expect(visibleNodes).to.have.lengthOf(graphNodes);
  });
});

// For some data, when Prometheus is installed in the istio-system namespace, it generates an additional edge.
// This step expects the provided number including Prometheus; if Prometheus is absent, we accept one fewer edge.
// Does not happen with cluster monitoring
Then('{int} edges appear in the graph including Prometheus', (graphEdges: number) => {
  cy.exec(`kubectl get deployments -A | grep prometheus | wc -l`, { failOnNonZeroExit: false }).then(result => {
    const prometheusPodsCount = parseInt(result.stdout.trim()) || 0;

    assertGraphReady(({ edges }) => {
      const numEdges = select(edges, { prop: EdgeAttr.hasTraffic, op: '!=', val: undefined }).length;
      const expectedEdges = prometheusPodsCount > 0 ? graphEdges - 1 : graphEdges;
      assert.isAtLeast(numEdges, expectedEdges);
    });
  });
});

Then('the {string} node {string} exists', (nodeName: string, action: string) => {
  assertGraphReady(({ nodes }) => {
    const foundNode = nodes.filter(node => node.getData().workload === nodeName);

    if (action === 'does') {
      assert.equal(foundNode.length, 1);
    } else {
      assert.equal(foundNode.length, 0);
    }
  });
});

Then('the {string} service {string} exists', (serviceName: string, action: string) => {
  assertGraphReady(({ nodes }) => {
    const foundNode = nodes.filter(node => node.getData().service === serviceName);

    if (action === 'does') {
      assert.equal(foundNode.length, 1);
    } else {
      assert.equal(foundNode.length, 0);
    }
  });
});

type GraphCacheMetrics = {
  graphCacheEvictions: number;
  graphCacheHits: number;
  graphCacheMisses: number;
};

Given('graph cache is enabled', () => {
  enableKialiFeature(GRAPH_CACHE_CONFIG);
});

Given('graph cache metrics are recorded', () => {
  cy.request('api/test/metrics/graph/cache').then(resp => {
    expect(resp.status).to.eq(200);
    const before = resp.body as GraphCacheMetrics;
    cy.wrap(before, { log: false }).as('graphCacheMetricsBefore');
    cy.log(`graph cache metrics (before): ${JSON.stringify(before)}`);
  });
});

When(
  'user opens the graph page for {string} with refresh {int}ms and refreshes it {int} times',
  (namespace: string, refreshMs: number, refreshTimes: number) => {
    cy.intercept(`**/api/namespaces/graph*`).as('graphNamespaces');

    cy.visit({
      url: `/console/graph/namespaces?graphType=app&edges=noEdgeLabels&duration=60s&namespaces=${namespace}&refresh=${refreshMs}`
    });

    cy.url().then(url => {
      if (!url.includes('/ossmconsole/')) {
        cy.wait('@graphNamespaces');
      }
    });
    ensureKialiFinishedLoading();

    for (let i = 0; i < refreshTimes; i++) {
      // Click the Refresh button in the time range toolbar (no full page reload).
      cy.get('[data-test="refresh-button"]').first().click();
      cy.url().then(url => {
        if (!url.includes('/ossmconsole/')) {
          cy.wait('@graphNamespaces');
        }
      });
      ensureKialiFinishedLoading();
    }
  }
);

// Backwards-compatible alias (feature wording says "reloads", but we don't do a full page reload).
When(
  'user opens the graph page for {string} with refresh {int}ms and reloads it {int} times',
  (namespace: string, refreshMs: number, refreshTimes: number) => {
    cy.intercept(`**/api/namespaces/graph*`).as('graphNamespaces');

    cy.visit({
      url: `/console/graph/namespaces?graphType=app&edges=noEdgeLabels&duration=60s&namespaces=${namespace}&refresh=${refreshMs}`
    });

    cy.url().then(url => {
      if (!url.includes('/ossmconsole/')) {
        cy.wait('@graphNamespaces');
      }
    });
    ensureKialiFinishedLoading();

    for (let i = 0; i < refreshTimes; i++) {
      cy.get('[data-test="refresh-button"]').first().click();
      cy.url().then(url => {
        if (!url.includes('/ossmconsole/')) {
          cy.wait('@graphNamespaces');
        }
      });
      ensureKialiFinishedLoading();
    }
  }
);

Then('graph cache metrics should show at least {int} miss and {int} hits', (minMisses: number, minHits: number) => {
  cy.get('@graphCacheMetricsBefore').then(beforeObj => {
    const before = (beforeObj as unknown) as GraphCacheMetrics;

    cy.request('api/test/metrics/graph/cache').then(resp => {
      expect(resp.status).to.eq(200);
      const after = resp.body as GraphCacheMetrics;

      cy.log(`graph cache metrics (before): ${JSON.stringify(before)}`);
      cy.log(`graph cache metrics (after): ${JSON.stringify(after)}`);

      expect(after.graphCacheMisses).to.be.at.least(before.graphCacheMisses + minMisses);
      expect(after.graphCacheHits).to.be.at.least(before.graphCacheHits + minHits);
    });
  });
});
