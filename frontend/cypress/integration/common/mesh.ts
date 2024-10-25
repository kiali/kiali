import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { Visualization } from '@patternfly/react-topology';
import { MeshInfraType, MeshNodeData } from 'types/Mesh';
import { elems } from './graph-pf';

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
  cy.getReact('MeshPageComponent', { state: { isReady: true } })
    .should('have.length', 1)
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.meshRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());

      const { nodes } = elems(controller);
      const node = nodes.find(n => (n.getData() as MeshNodeData).infraType === MeshInfraType.CLUSTER);
      assert.exists(node);

      const setSelectedIds = state.meshRefs.setSelectedIds as (values: string[]) => void;
      setSelectedIds([node!.getId()]);
    });
});

When('user selects mesh node with label {string}', (label: string) => {
  cy.waitForReact();
  cy.getReact('MeshPageComponent', { state: { isReady: true } })
    .should('have.length', 1)
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.meshRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());

      const { nodes } = elems(controller);
      const node = nodes.find(n => n.getLabel() === label);
      assert.exists(node);

      const setSelectedIds = state.meshRefs.setSelectedIds as (values: string[]) => void;
      setSelectedIds([node!.getId()]);
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
      cy.get('div[data-test="control-plane-certificate"]').should('exist');
      cy.get('[data-test="label-TLS"]').contains('N/A');
    });
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
  cy.getReact('MeshPageComponent', { state: { isReady: true } })
    .should('have.length', 1)
    .then($graph => {
      const { state } = $graph[0];

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
    cy.getReact('MeshPageComponent', { state: { isReady: true } })
      .should('have.length', 1)
      .then($graph => {
        const { state } = $graph[0];

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
  cy.getReact('MeshPageComponent', { state: { isReady: true } })
    .should('have.length', 1)
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.meshRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());

      const { nodes } = elems(controller);
      const istiodNode = nodes.find(n => n.getData().infraType === MeshInfraType.ISTIOD);

      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(istiodNode).to.exist;
      expect(istiodNode?.getSourceEdges()).to.have.lengthOf(2);

      istiodNode?.getSourceEdges().every(e => {
        const targetNodeData = e.getTarget().getData();
        return targetNodeData.infraType === MeshInfraType.DATAPLANE && targetNodeData.cluster === 'cluster';
      });
    });
});

Then('user {string} mesh tour', (action: string) => {
  cy.waitForReact();
  if (action === 'sees') {
    cy.get('.pf-v5-c-popover').find('span').contains('Shortcuts').should('exist');
  } else {
    cy.get('.pf-v5-c-popover').should('not.exist');
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
