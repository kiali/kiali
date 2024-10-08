/*
  This file contains graph related step definitions
  that are common to multiple features.
*/

import { Then } from '@badeball/cypress-cucumber-preprocessor';
import { Controller, Edge, Node, isNode, isEdge, GraphElement, Visualization } from '@patternfly/react-topology';

Then('user does not see a minigraph', () => {
  cy.get('#MiniGraphCard').find('h5').contains('Empty Graph');
});

Then('user sees a minigraph', () => {
  cy.waitForReact();
  cy.getReact('MiniGraphCardPFComponent', { state: { isReady: true } })
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
    });
});

Then('user sees the {string} namespace deployed across the east and west clusters', (namespace: string) => {
  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { isReady: true } })
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
});

Then('nodes in the {string} cluster should contain the cluster name in their links', (cluster: string) => {
  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { isReady: true } })
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
});

Then(
  'user clicks on the {string} workload in the {string} namespace in the {string} cluster',
  (workload: string, namespace: string, cluster: string) => {
    cy.waitForReact();
    cy.getReact('GraphPageComponent', { state: { isReady: true } })
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

Then('user sees a link to the {string} cluster workload details page in the summary panel', (cluster: string) => {
  cy.get('#graph-side-panel').within(() => {
    if (cluster === 'east') {
      // Should not include any links since the "east" cluster doesn't include the clusterName in the links.
      cy.get(`a[href*="clusterName=${cluster}"]`).should('have.length', 0);
    } else {
      // Should include three links: app, service, workload.
      cy.get(`a[href*="clusterName=${cluster}"]`).should('have.length', 3);
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
