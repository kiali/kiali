import { Before, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { Controller, Edge, Node, Visualization, isEdge, isNode } from '@patternfly/react-topology';
import { MeshInfraType, MeshNodeData } from 'types/Mesh';

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

When('user closes mesh tour', () => {
  cy.waitForReact();
  cy.get('div[role="dialog"]').find('button[aria-label="Close"]').click();
});

When('user opens mesh tour', () => {
  cy.waitForReact();
  cy.get('button#mesh-tour').click();
});

When('user selects cluster mesh node', () => {
  cy.waitForReact();
  cy.getReact('MeshPageComponent', { state: { meshData: { isLoading: false } } })
    .should('have.length', 1)
    .getCurrentState()
    .then(state => {
      const controller = state.meshRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { nodes } = elems(controller);
      const node = nodes.find(n => (n.getData() as MeshNodeData).infraType === MeshInfraType.CLUSTER);
      assert.exists(node);
      const setSelectedIds = state.meshRefs.setSelectedIds as (values: string[]) => void;
      setSelectedIds([node.getId()]);
    });
});

When('user selects mesh node with label {string}', (label: string) => {
  cy.waitForReact();
  cy.getReact('MeshPageComponent', { state: { meshData: { isLoading: false } } })
    .should('have.length', 1)
    .getCurrentState()
    .then(state => {
      const controller = state.meshRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { nodes } = elems(controller);
      const node = nodes.find(n => n.getLabel() === label);
      assert.exists(node);
      const setSelectedIds = state.meshRefs.setSelectedIds as (values: string[]) => void;
      setSelectedIds([node.getId()]);
    });
});

When('user sees mesh side panel', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.get('#target-panel-mesh')
    .should('be.visible')
    .within(() => {
      // Get the name of the mesh from the API.
      cy.request({ url: 'api/mesh/graph' }).then(resp => {
        expect(resp.status).to.eq(200);
        expect(resp.body.meshName).to.not.equal(undefined);
        expect(resp.body.meshName).to.not.equal('');
        cy.contains(`Mesh Name: ${resp.body.meshName}`);
      });
    });
});

Then('user sees cluster side panel', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.get('#target-panel-cluster').should('be.visible');
});

Then('user sees control plane side panel', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.get('#target-panel-control-plane')
    .should('be.visible')
    .within(() => {
      cy.contains('istiod');
      cy.contains('Control plane').should('be.visible');
      cy.contains('Outbound policy').should('be.visible');
      cy.get('div[data-test="memory-chart"]').should('exist');
      cy.get('div[data-test="cpu-chart"]').should('exist');
      cy.get('[data-test="label-TLS"]').contains('N/A');
      cy.get('[data-test="lockerCA"]').should('exist');
    });
  cy.get('[data-test="lockerCA"]').trigger('mouseenter');
  cy.get('[role="tooltip"]').contains('Valid From');
});

Then('user sees data plane side panel', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.get('#target-panel-data-plane')
    .should('be.visible')
    .within(() => {
      cy.contains('Data Plane');
    });
});

Then('user sees expected mesh infra', () => {
  cy.waitForReact();
  cy.getReact('MeshPageComponent', { state: { meshData: { isLoading: false } } })
    .should('have.length', 1)
    .getCurrentState()
    .then(state => {
      const controller = state.meshRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { nodes, edges } = elems(controller);
      const nodeNames = nodes.map(n => n.getLabel());
      const nodesLength = nodeNames.some(n => n === 'External Deployments') ? 9 : 8;
      assert.equal(nodes.length, nodesLength, 'Unexpected number of infra nodes');
      assert.equal(edges.length, 5, 'Unexpected number of infra edges');
      assert.isTrue(nodeNames.some(n => n === 'Data Plane'));
      assert.isTrue(nodeNames.some(n => n === 'Grafana'));
      assert.isTrue(nodeNames.some(n => n.startsWith('istiod')));
      assert.isTrue(nodeNames.some(n => n === 'jaeger' || n === 'Tempo'));
      assert.isTrue(nodeNames.some(n => n === 'kiali'));
      assert.isTrue(nodeNames.some(n => n === 'Prometheus'));
    });
});

Then(
  'user sees {int} {string} nodes on the {string} cluster',
  (numberOfDataplaneNodes: number, infraNodeType: MeshInfraType, cluster: string) => {
    cy.waitForReact();
    cy.getReact('MeshPageComponent', { state: { meshData: { isLoading: false } } })
      .should('have.length', 1)
      .getCurrentState()
      .then(state => {
        const controller = state.meshRefs.getController() as Visualization;
        assert.isTrue(controller.hasGraph());
        const { nodes } = elems(controller);
        const dataplaneNodes = nodes.filter(
          n => n.getData().infraType === infraNodeType && n.getData().cluster === cluster
        );
        expect(dataplaneNodes).to.have.lengthOf(numberOfDataplaneNodes);
      });
  }
);

Then('user sees the istiod node connected to the dataplane nodes', () => {
  cy.waitForReact();
  cy.getReact('MeshPageComponent', { state: { meshData: { isLoading: false } } })
    .should('have.length', 1)
    .getCurrentState()
    .then(state => {
      const controller = state.meshRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { nodes } = elems(controller);
      const istiodNode = nodes.find(n => n.getData().infraType === MeshInfraType.ISTIOD);
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(istiodNode).to.exist;
      expect(istiodNode.getSourceEdges()).to.have.lengthOf(2);
      istiodNode.getSourceEdges().every(e => {
        const targetNodeData = e.getTarget().getData();
        return targetNodeData.infraType === MeshInfraType.DATAPLANE && targetNodeData.cluster === 'cluster';
      });
    });
});

Then('user {string} mesh tour', (action: string) => {
  cy.waitForReact();
  if (action === 'sees') {
    cy.get('div[class*="pf-v5-c-popover"]').find('span').contains('Shortcuts').should('exist');
  } else {
    cy.get('div[class*="pf-v5-c-popover"]').should('not.exist');
  }
});

Then('user sees {string} namespace side panel', (name: string) => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.get('#target-panel-namespace')
    .should('be.visible')
    .within(() => {
      cy.contains(name);
    });
});

Then('user sees {string} node side panel', (name: string) => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.get('#target-panel-node')
    .should('be.visible')
    .within(() => {
      cy.contains(name);
    });
});

//
// Since I can't import from MeshElems.tsx, copying some helpers here...
//

const elems = (c: Controller): { edges: Edge[]; nodes: Node[] } => {
  const elems = c.getElements();

  return {
    nodes: elems.filter(e => isNode(e)) as Node[],
    edges: elems.filter(e => isEdge(e)) as Edge[]
  };
};
