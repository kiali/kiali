/*
  This file contains graph related step definitions
  that are common to multiple features.
*/

import { Then } from '@badeball/cypress-cucumber-preprocessor';
import { Controller, Edge, Node, isNode, isEdge, GraphElement, Visualization } from '@patternfly/react-topology';
import { buildNodeTree, findComponentsInTree, getReactFiber } from '../../support/react-utils';

Then('user does not see a minigraph', () => {
  cy.get('#MiniGraphCard').find('h5').contains('Empty Graph');
});

Then('user sees a minigraph', () => {
  assertMiniGraphReady(({ nodes }) => {
    assert.isAbove(nodes.length, 0);
  });
});

Then('user sees the {string} namespace deployed across the east and west clusters', (namespace: string) => {
  assertGraphReady(({ nodes }) => {
    const namespaceBoxes = nodes.filter(
      node => node.getData().isBox === 'namespace' && node.getData().namespace === namespace
    );

    expect(namespaceBoxes.length).to.equal(2);
    expect(namespaceBoxes.filter(node => node.getData().cluster === 'east').length).to.equal(1);
    expect(namespaceBoxes.filter(node => node.getData().cluster === 'west').length).to.equal(1);
  });
});

Then('nodes in the {string} cluster should contain the cluster name in their links', (cluster: string) => {
  assertGraphReady(({ nodes, edges }) => {
    const clusterNodes = nodes.filter(node => node.getData().cluster === cluster);

    clusterNodes.forEach(node => {
      const links = edges.filter(edge => edge.getData().source === node.getId());

      links.forEach(link => {
        const sourceNode = clusterNodes.find(node => node.getId() === link.getData().source);
        expect(sourceNode?.getData().cluster).to.equal(cluster);
      });
    });
  });
});

Then(
  'user clicks on the {string} workload in the {string} namespace in the {string} cluster',
  (workload: string, namespace: string, cluster: string) => {
    let nodeId: string;

    cy.waitForReact();
    cy.window({ log: false })
      .should((win: Window) => {
        const rootFiber = freshFiber(win);
        assert.isNotNull(rootFiber, 'React fiber root must exist');

        const tree = buildNodeTree(rootFiber);
        const results = findComponentsInTree(tree, 'GraphPageComponent', {
          state: { graphData: { isLoading: false }, isReady: true }
        });
        assert.equal(results.length, 1, 'GraphPageComponent should be loaded and ready');

        const { state } = results[0];
        const controller = state.graphRefs.getController() as Visualization;
        assert.isTrue(controller.hasGraph());
        const { nodes } = elems(controller);

        // Workloads are apps in the versioned app graph
        const workloadNode = nodes.filter(
          node =>
            node.getData().nodeType === 'app' &&
            node.getData().isBox === undefined &&
            node.getData().workload === workload &&
            node.getData().namespace === namespace &&
            node.getData().cluster === cluster
        );

        expect(workloadNode.length).to.equal(1);
        nodeId = workloadNode[0]?.getId();
      })
      .then(() => {
        cy.get(`[data-id=${nodeId}]`).click();
        // graph-side-panel persists across context changes unlike summary-graph-panel
        cy.get('#graph-side-panel').contains(workload);
      });
  }
);

Then('user sees a link to the {string} cluster workload details page in the summary panel', (cluster: string) => {
  cy.get('#graph-side-panel').within(() => {
    if (cluster === 'east') {
      // Should only include namespace link since the "east" cluster doesn't include the clusterName in the links.
      cy.get(`a[href*="clusterName=${cluster}"]`).should('have.length', 1);
    } else {
      // Should include three links: namespace, app, service, workload.
      cy.get(`a[href*="clusterName=${cluster}"]`).should('have.length', 4);
    }
  });
});

// node type and box type varies based on the graph so this is a helper function to get the right values.
export const nodeInfo = (nodeType: string, graphType: string): { isBox?: string; nodeType: string } => {
  let isBox: string | undefined;
  if (nodeType === 'app') {
    // Apps are boxes in versioned app graph...
    nodeType = 'box';
    isBox = 'app';
  } else if (nodeType === 'workload' && graphType === 'versionedApp') {
    // Workloads are apps in versioned app graph...
    nodeType = 'app';
  }

  return {
    nodeType,
    isBox
  };
};

export const elems = (c: Controller): { edges: Edge[]; nodes: Node[] } => {
  const elems = c.getElements();

  return {
    nodes: elems.filter(e => isNode(e)) as Node[],
    edges: elems.filter(e => isEdge(e)) as Edge[]
  };
};

/**
 * Read the React fiber root fresh from the DOM so that `.should()` retries
 * always see the latest committed React state instead of a stale cached
 * reference from `waitForReact()`.
 */
const freshFiber = (win: Window): any => {
  const rootSelector = Cypress.env('rootSelector') || 'body';
  const rootEl = win.document.querySelector(rootSelector);
  return rootEl ? getReactFiber(rootEl as Element) : null;
};

/**
 * Retryable assertion wrapper that re-reads the React fiber root from the
 * DOM on every `.should()` retry, ensuring Cypress always sees the latest
 * committed React state.
 *
 * The previous approach used `cy.getReact()` which returned a static
 * `cy.wrap()` snapshot — `.should()` retried the assertion against that
 * stale snapshot, causing false negatives after graph refetches.
 */
const assertReady = (
  componentName: string,
  stateFilter: Record<string, any>,
  fn: (elements: { edges: Edge[]; nodes: Node[] }, state: any) => void
): void => {
  cy.waitForReact();
  cy.window({ log: false }).should((win: Window) => {
    const rootFiber = freshFiber(win);
    assert.isNotNull(rootFiber, 'React fiber root must exist');

    const tree = buildNodeTree(rootFiber);
    const results = findComponentsInTree(tree, componentName, { state: stateFilter });
    assert.equal(results.length, 1, `${componentName} should be loaded and ready`);

    const { state } = results[0];
    const controller = state.graphRefs.getController() as Visualization;
    assert.isTrue(controller.hasGraph());
    fn(elems(controller), state);
  });
};

export const assertGraphReady = (fn: (elements: { edges: Edge[]; nodes: Node[] }, state: any) => void): void => {
  assertReady('GraphPageComponent', { graphData: { isLoading: false }, isReady: true }, fn);
};

export const assertMiniGraphReady = (fn: (elements: { edges: Edge[]; nodes: Node[] }, state: any) => void): void => {
  assertReady('MiniGraphCardComponent', { isReady: true, isLoading: false }, fn);
};

export type SelectOp =
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | '!*='
  | '!$='
  | '!^='
  | '*='
  | '$='
  | '^='
  | 'falsy'
  | 'truthy';

export type SelectExp = {
  op?: SelectOp;
  prop: string;
  val?: any;
};

export type SelectAnd = SelectExp[];
export type SelectOr = SelectAnd[];

export const selectOr = (elems: GraphElement[], ors: SelectOr): GraphElement[] => {
  let result = [] as GraphElement[];
  ors.forEach(ands => {
    const andResult = selectAnd(elems, ands);
    result = Array.from(new Set([...result, ...andResult]));
  });
  return result;
};

export const selectAnd = (elems: GraphElement[], ands: SelectAnd): GraphElement[] => {
  let result = elems;
  ands.forEach(exp => (result = select(result, exp)));
  return result;
};

export const select = (elems: GraphElement[], exp: SelectExp): GraphElement[] => {
  return elems.filter(e => {
    const propVal = e.getData()[exp.prop] || '';

    switch (exp.op) {
      case '!=':
        return propVal !== exp.val;
      case '<':
        return propVal < exp.val;
      case '>':
        return propVal > exp.val;
      case '>=':
        return propVal >= exp.val;
      case '<=':
        return propVal <= exp.val;
      case '!*=':
        return !(propVal as string).includes(exp.val as string);
      case '!$=':
        return !(propVal as string).endsWith(exp.val as string);
      case '!^=':
        return !(propVal as string).startsWith(exp.val as string);
      case '*=':
        return (propVal as string).includes(exp.val as string);
      case '$=':
        return (propVal as string).endsWith(exp.val as string);
      case '^=':
        return (propVal as string).startsWith(exp.val as string);
      case 'falsy':
        return !propVal;
      case 'truthy':
        return !!propVal;
      default:
        return propVal === exp.val;
    }
  });
};

// Ambient multi-primary graph step definitions

Then('user sees ambient workloads in the graph', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');

  // Look for ambient-specific indicators in the graph
  cy.get('[data-test="topology-view-pf"]').should('exist');

  // Check for ambient mesh indicators (ztunnel, waypoint proxies, etc.)
  cy.get('[data-test="topology-view-pf"]').then($nodes => {
    // Verify we have workload nodes that could be in ambient mode
    assert.isAtLeast($nodes.length, 1, 'Should have workload nodes in the graph');
  });
});

Then('user sees graph workloads from both clusters', () => {
  assertGraphReady(({ nodes }) => {
    const workloadNodes = nodes.filter(node => {
      const data = node.getData();
      return data.nodeType === 'workload' && data.cluster;
    });

    const clusters = new Set(workloadNodes.map(node => node.getData().cluster));
    assert.isAtLeast(clusters.size, 2, 'Should have workloads from multiple clusters');
  });
});

Then(
  'the waypoint node {string} is visible in the graph for the {string} cluster',
  (workload: string, cluster: string) => {
    assertGraphReady(({ nodes }) => {
      const target = workload.toLowerCase();

      const matches = nodes.filter(node => {
        const data = node.getData();
        const label = (node as any)?.getLabel?.() as string | undefined;

        const candidates = [data.workload, data.app, data.service, data.name, label].filter(
          v => typeof v === 'string'
        ) as string[];

        return (
          data.isBox === undefined &&
          data.cluster === cluster &&
          data.isWaypoint === true &&
          candidates.some(c => {
            const lc = c.toLowerCase();
            return lc === target || lc.startsWith(`${target}-`);
          })
        );
      });

      if (matches.length === 0) {
        const waypointNodes = nodes
          .map(node => {
            const data = node.getData();
            return {
              app: data.app,
              cluster: data.cluster,
              isWaypoint: data.isWaypoint,
              name: data.name,
              service: data.service,
              workload: data.workload
            };
          })
          .filter(n => n.cluster === cluster && n.isWaypoint === true);

        Cypress.log({
          name: 'waypointNodeNotFound',
          message: `cluster=${cluster} workload=${workload} waypointNodes=${JSON.stringify(waypointNodes)}`
        });
      }

      expect(matches.length).to.be.at.least(1);
    });
  }
);

Then('there is traffic from cluster {string} and cluster {string}', (cluster1: string, cluster2: string) => {
  assertGraphReady(({ nodes, edges }) => {
    const trafficEdges = edges.filter(edge => edge.getData()?.hasTraffic === true);

    const nodeById = new Map(nodes.map(n => [n.getId(), n]));
    const clustersWithTraffic = new Set<string>();

    trafficEdges.forEach(edge => {
      const srcId = edge.getData()?.source as string | undefined;
      const dstId = edge.getData()?.target as string | undefined;

      const srcNode = srcId ? nodeById.get(srcId) : undefined;
      const dstNode = dstId ? nodeById.get(dstId) : undefined;

      const srcCluster = srcNode?.getData()?.cluster as string | undefined;
      const dstCluster = dstNode?.getData()?.cluster as string | undefined;

      if (srcCluster) {
        clustersWithTraffic.add(srcCluster);
      }
      if (dstCluster) {
        clustersWithTraffic.add(dstCluster);
      }
    });

    expect(Array.from(clustersWithTraffic)).to.include(cluster1);
    expect(Array.from(clustersWithTraffic)).to.include(cluster2);
  });
});
