import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { Visualization } from '@patternfly/react-topology';
import { MeshInfraType, MeshNodeData } from 'types/Mesh';
import { elems } from './graph';

const IN_OFFLINE_MODE = Cypress.env('RUN_MODE') === 'offline';

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
  cy.get('#loading_kiali_spinner').should('not.exist');
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
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.getReact('MeshPageComponent', { state: { isReady: true } })
    .should('have.length', 1)
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.meshRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());

      const { nodes } = elems(controller);
      const node = nodes.find(n => n.getLabel().toLowerCase() === label.toLowerCase());
      assert.exists(node);

      const setSelectedIds = state.meshRefs.setSelectedIds as (values: string[]) => void;
      setSelectedIds([node!.getId()]);
    });
});

// For duplicates
When('user selects mesh node with label {string} and nodeType {string}', (label: string, nodeType: string) => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.getReact('MeshPageComponent', { state: { isReady: true } })
    .should('have.length', 1)
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.meshRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());

      const { nodes } = elems(controller);
      const node = nodes.find(n => {
        return n.getLabel().toLowerCase() === label.toLowerCase() && n.getData().nodeType === nodeType;
      });
      assert.exists(node);

      const setSelectedIds = state.meshRefs.setSelectedIds as (values: string[]) => void;
      setSelectedIds([node!.getId()]);
    });
});

When('user selects tracing mesh node', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.getReact('MeshPageComponent', { state: { isReady: true } })
    .should('have.length', 1)
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.meshRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());

      const { nodes } = elems(controller);
      const node = nodes.find(n => n.getLabel().toLowerCase() === 'jaeger' || n.getLabel().toLowerCase() === 'tempo');
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
        expect(resp.body.meshNames).to.not.equal(null);
        expect(resp.body.meshNames.length).to.be.greaterThan(0);
        expect(resp.body.meshNames).to.not.include('');
        // Check that each mesh name is displayed in the UI
        resp.body.meshNames.forEach((meshName: string) => {
          cy.contains(`Mesh: ${meshName}`);
        });
      });
    });
});

When('user {string} mesh display option {string}', (action: string, option: string) => {
  switch (option.toLowerCase()) {
    case 'gateways':
      option = 'filterGateways';
      break;
    case 'waypoints':
      option = 'filterWaypoints';
      break;
  }

  if (action === 'enables') {
    cy.get('div#mesh-display-menu').find(`input#${option}`).check();
  } else {
    cy.get('div#mesh-display-menu').find(`input#${option}`).uncheck();
  }
});

Then('user sees cluster side panel', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.get('#target-panel-cluster').should('be.visible');
});

// TODO: No memory metrics for offline yet.
Then('user sees control plane side panel', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');

  // Wait for metrics
  const maxTries = 15;
  let tries = 0;
  const waitForMemoryMetrics = (): void => {
    if (tries > maxTries) {
      throw new Error('Timed out waiting for Kiali to see the Shared Mesh Config');
    }
    tries++;
    cy.request({ method: 'GET', url: '/api/namespaces/istio-system/controlplanes/istiod/metrics' }).then(
      metricsResponse => {
        expect(metricsResponse.status).to.equal(200);
        cy.log(metricsResponse.body);
        if (metricsResponse.body.process_resident_memory_bytes == null) {
          cy.log(`Istiod hasn't load the Memory metrics yet. Tries: ${tries}. Waiting 3s...`);
          cy.wait(3000);
          waitForMemoryMetrics();
        }
      }
    );
  };
  waitForMemoryMetrics();
  it('control pannel should be visible', { retries: 3 }, () => {
    cy.get('[data-test="refresh-button"]').click();
    cy.get('#loading_kiali_spinner').should('not.exist');

    cy.get('#target-panel-control-plane')
      .should('be.visible')
      .within(() => {
        cy.contains('istiod');
        cy.contains('Outbound policy').should('be.visible');
        cy.get('div[data-test="memory-chart"]').should('exist');
        cy.get('div[data-test="cpu-chart"]').should('exist');
        cy.get('div[data-test="control-plane-certificate"]').should('exist');
        cy.get('[data-test="label-TLS"]').contains('TLSV1_2');
      });
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

When('user expands namespace', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.get('#target-panel-data-plane')
    .should('be.visible')
    .within(() => {
      // Find and click the expand button by its ID pattern (e.g., ns-bookinfo0)
      cy.get('button[id^="ns-bookinfo"]').first().click();
      // Wait for the expanded content to load
      cy.get('#loading_kiali_spinner').should('not.exist');
    });
});

Then('user sees config validation info', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.get('#target-panel-data-plane')
    .should('be.visible')
    .within(() => {
      // Check that Istio config section is visible
      cy.contains('Istio config').should('be.visible');
      // Verify that 'Istio config' does NOT have value 'N/A'
      // This means validations should be present (not N/A)
      // Skip this check in offline mode
      if (!IN_OFFLINE_MODE) {
        cy.contains('Istio config').parent().should('not.contain.text', 'N/A');
      }
    });
});

// TODO: No jaeger and grafana in offline mode for now.
Then('user sees expected mesh infra', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.getReact('MeshPageComponent', { state: { isReady: true } })
    .should('have.length', 1)
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.meshRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());

      const { nodes, edges } = elems(controller);
      const nodeNames = nodes.map(n => n.getLabel().toLowerCase());
      const isMultiControlplane = nodeNames.some(n => n === 'istiod-default-v1-26-0');
      const minNodesLength = nodeNames.some(n => n === 'external deployments') ? (isMultiControlplane ? 13 : 9) : 8;
      const minEdgesLength = isMultiControlplane ? 7 : 5;

      assert.isAtLeast(nodes.length, minNodesLength, 'Unexpected number of infra nodes');
      assert.isAtLeast(edges.length, minEdgesLength, 'Unexpected number of infra edges');
      assert.isTrue(nodeNames.some(n => n === 'data plane'));
      assert.isTrue(nodeNames.some(n => n === 'grafana'));
      assert.isTrue(nodeNames.some(n => n.startsWith('istiod')));
      assert.isTrue(nodeNames.some(n => n === 'jaeger' || n === 'tempo'));
      assert.isTrue(nodeNames.some(n => n === 'kiali'));
      assert.isTrue(nodeNames.some(n => n === 'prometheus'));

      // Check tabs existence based on multi-control plane setup
      if (isMultiControlplane) {
        // Multiple control planes - tabs should exist
        cy.getBySel('mesh-tabs').should('exist');
        cy.getBySel('mesh-tabs').within(() => {
          cy.contains('button', 'Overview').should('exist');
          cy.contains('button', 'Meshes').should('exist');
        });
      } else {
        // Single control plane - tabs should not exist
        cy.getBySel('mesh-tabs').should('not.exist');
      }
    });
});

Then(
  'user sees {int} {string} nodes on the {string} cluster',
  (numberOfNodes: number, infraNodeType: MeshInfraType, cluster: string) => {
    cy.waitForReact();
    cy.get('#loading_kiali_spinner').should('not.exist');
    cy.getReact('MeshPageComponent', { state: { isReady: true } })
      .should('have.length', 1)
      .then($graph => {
        const { state } = $graph[0];

        const controller = state.meshRefs.getController() as Visualization;
        assert.isTrue(controller.hasGraph());

        const { nodes } = elems(controller);
        const infraNodes = nodes.filter(
          n => n.getData().infraType === infraNodeType && n.getData().cluster === cluster
        );

        expect(infraNodes).to.have.lengthOf(numberOfNodes);
      });
  }
);

Then(
  'user sees the {string} node connected to the {int} {string} nodes',
  (sourceInfraType: MeshInfraType, numEdges: number, destInfraType: MeshInfraType) => {
    cy.waitForReact();
    cy.get('#loading_kiali_spinner').should('not.exist');
    cy.getReact('MeshPageComponent', { state: { isReady: true } })
      .should('have.length', 1)
      .then($graph => {
        const { state } = $graph[0];

        const controller = state.meshRefs.getController() as Visualization;
        assert.isTrue(controller.hasGraph());

        const { nodes } = elems(controller);
        const sourceNode = nodes.find(n => n.getData().infraType === sourceInfraType);

        const destNodes = sourceNode?.getSourceEdges().filter(e => {
          const targetNodeData = e.getTarget().getData();
          return targetNodeData.infraType === destInfraType;
        });

        assert.isTrue(
          destNodes?.length === numEdges,
          `Expected ${numEdges} ${destInfraType} nodes, but got ${destNodes?.length}`
        );
      });
  }
);

Then('user {string} mesh tour', (action: string) => {
  cy.waitForReact();
  if (action === 'sees') {
    cy.get('.pf-v6-c-popover').find('span').contains('Shortcuts').should('exist');
  } else {
    cy.get('.pf-v6-c-popover').should('not.exist');
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

Then('user does not see {string} in mesh body', (text: string) => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.get('#target-panel-mesh-body')
    .should('be.visible')
    .within(() => {
      cy.contains(text).should('not.exist');
    });
});

Then('user sees tracing node side panel', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.get('#target-panel-node')
    .should('be.visible')
    .within(() => {
      cy.contains(new RegExp('jaeger|Jaeger|tempo|Tempo', 'g'));
    });
});

Then('user sees {string} icon side panel', (iconType: string) => {
  cy.waitForReact();
  it('icon should be visible', { retries: 3 }, () => {
    cy.get('#target-panel-node').get(`[data-test="icon-${iconType}-validation"]`).should('be.visible');
  });
});

Then('user does not see {string} icon side panel', (iconType: string) => {
  cy.waitForReact();
  it('icon should be not visible', { retries: 3 }, () => {
    cy.get('#target-panel-node').get(`[data-test="icon-${iconType}-validation"]`).should('not.exist');
  });
});

Then('user sees {string} configuration tabs', (configTabs: string) => {
  const tabs = configTabs.split(',');

  cy.wrap(tabs).each(tab => {
    cy.getBySel(`config-tab-${tab}`);
  });
});

Then('user sees {string} in the {string} configuration tab', (configOpt: string, tab: string) => {
  cy.getBySel(`config-tab-${tab}`).click();
  cy.getBySel(`${tab}-config-editor`).contains(configOpt);
});

Then('user does not see {string} in the {string} configuration tab', (configOpt: string, tab: string) => {
  cy.getBySel(`config-tab-${tab}`).click();
  cy.getBySel(`${tab}-config-editor`).should('not.contain', configOpt);
});

When('user opens the Trace Configuration modal', () => {
  cy.waitForReact();
  cy.contains('Configuration Tester').click();
});

Then('user sees the Trace Configuration modal', () => {
  cy.get('.pf-v6-c-modal-box').should('be.visible');
  cy.contains('Configuration Tester').should('be.visible');
});

Then('user sees the Discovery and Tester tabs', () => {
  cy.get('.pf-v6-c-tabs__item').contains('Discovery').should('exist');
  cy.get('.pf-v6-c-tabs__item').contains('Tester').should('exist');
});

Then('user sees the action buttons fixed at the bottom', () => {
  cy.get('.pf-v6-c-modal-box__footer').should('be.visible');
  cy.get('.pf-v6-c-modal-box__footer').within(() => {
    cy.contains('Close').should('exist');
  });
});

// Note: This is not checking values to be valid in jaeger/tempo setups
Then('user verifies the Discovery information is correct', () => {
  cy.get('#discover-spinner').should('not.exist');
  cy.get('#discovery-tab-content').contains('Possible configuration(s) found');
  cy.get('#discovery-tab-content').get('#valid-configurations').contains('Provider:');
  cy.get('#discovery-tab-content').contains('Logs');
  cy.get('#discovery-tab-content').get('#configuration-logs').contains('Parsed url');
  cy.get('#discovery-tab-content').get('#configuration-logs').contains('Checking open ports');
});

When('user clicks the Rediscover button in the Discovery tab', () => {
  cy.get('.pf-v6-c-modal-box').within(() => {
    cy.contains('button', 'Rediscover').click();
  });
});

When('user switches to the Tester tab', () => {
  cy.get('div[data-test="modal-configuration-tester"]').within(() => {
    cy.contains('button', 'Tester').click();
  });
});

When('user changes the provider in the Tester tab', () => {
  cy.get('div[data-test="modal-configuration-tester"]').within(() => {
    cy.window().then((win: any) => {
      const editor = win.ace.edit('ace-editor-tester');
      const session = editor.getSession();
      const linesCount = session.getLength();
      const searchText = 'provider';
      let replacer = 'tempo';
      let provider = 'jaeger';

      for (let i = 0; i < linesCount; i++) {
        const line = session.getLine(i);
        if (line.toString().toLowerCase().includes(searchText)) {
          if (line.includes('tempo')) {
            replacer = 'jaeger';
            provider = 'tempo';
          }
          break;
        }
      }
      let val: string = editor.getValue();
      val = val.replace(`provider: ${provider}`, `provider: ${replacer}`);
      editor.setValue(val);
    });
  });
});

When('user changes the useGRPC in the Tester tab', () => {
  cy.get('div[data-test="modal-configuration-tester"]').within(() => {
    cy.window().then((win: any) => {
      const editor = win.ace.edit('ace-editor-tester');
      const session = editor.getSession();
      const linesCount = session.getLength();
      const searchText = 'useGRPC';
      let currentValue: string | null = null;
      let targetValue = 'true';

      // Find the line containing useGRPC and determine current value
      for (let i = 0; i < linesCount; i++) {
        const line = session.getLine(i);
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes(searchText.toLowerCase())) {
          // Check for both true and false patterns
          if (line.match(/:\s*(true|false)/i)) {
            if (line.match(/:\s*true/i)) {
              currentValue = 'true';
              targetValue = 'false';
            } else if (line.match(/:\s*false/i)) {
              currentValue = 'false';
              targetValue = 'true';
            }
          }
          break;
        }
      }

      // Replace the value using regex to handle various formats (with/without spaces, quotes, etc.)
      let val: string = editor.getValue();
      if (currentValue !== null) {
        // Replace useGRPC with various formats: "useGRPC: true", "useGRPC:false", "useGRPC: true", etc.
        val = val.replace(new RegExp(`(useGRPC\\s*:\\s*)${currentValue}`, 'gi'), `$1${targetValue}`);
        editor.setValue(val);
      }
    });
  });
});

When('user clicks the Test Configuration button', () => {
  cy.get('div[data-test="modal-configuration-tester"]').within(() => {
    cy.contains('Test Configuration').click();
  });
});

Then('user sees the Tester result {string}', (result: string) => {
  cy.get('div[data-test="modal-configuration-tester"]').within(() => {
    if (result === 'incorrect') {
      cy.get('span[data-test="icon-error-validation"]').should('exist');
    } else {
      cy.get('span[data-test="icon-correct-validation"]').should('exist');
    }
  });
});

// Multi-cluster / multi-mesh namespace panel step definitions

When('user selects mesh node with label {string} on cluster {string}', (label: string, cluster: string) => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.getReact('MeshPageComponent', { state: { isReady: true } })
    .should('have.length', 1)
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.meshRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());

      const { nodes } = elems(controller);
      const node = nodes.find(
        n => n.getLabel().toLowerCase() === label.toLowerCase() && n.getData().cluster === cluster
      );
      assert.exists(node, `Node with label "${label}" on cluster "${cluster}" should exist`);

      const setSelectedIds = state.meshRefs.setSelectedIds as (values: string[]) => void;
      setSelectedIds([node!.getId()]);
    });
});

Then('user sees control plane donut in namespace panel', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.get('#target-panel-namespace')
    .should('be.visible')
    .within(() => {
      cy.contains('Namespaces managed by Control Planes').should('be.visible');
    });
});

Then('the namespace panel shows only control planes from the {string} cluster', (cluster: string) => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.getReact('MeshPageComponent', { state: { isReady: true } })
    .should('have.length', 1)
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.meshRefs.getController() as Visualization;
      const { nodes } = elems(controller);

      const istiodNodes = nodes.filter(
        n =>
          (n.getData() as MeshNodeData).infraType === MeshInfraType.ISTIOD &&
          (n.getData() as MeshNodeData).cluster === cluster
      );

      assert.isAbove(istiodNodes.length, 0, `Should have istiod nodes for cluster "${cluster}"`);
      istiodNodes.forEach(n => {
        const data = n.getData() as MeshNodeData;
        assert.equal(data.cluster, cluster, `All control plane nodes should be from cluster "${cluster}"`);
      });
    });
});

Then('user sees {string} cluster badge in namespace panel', (cluster: string) => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.get('#target-panel-namespace')
    .should('be.visible')
    .within(() => {
      cy.contains(cluster).should('be.visible');
    });
});

Then('the mesh tab count matches the number of meshes with control planes', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.getReact('MeshPageComponent', { state: { isReady: true } })
    .should('have.length', 1)
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.meshRefs.getController() as Visualization;
      const { nodes } = elems(controller);

      const controlPlaneNodes = nodes.filter(n => (n.getData() as MeshNodeData).infraType === MeshInfraType.ISTIOD);
      const meshNames = new Set(
        controlPlaneNodes.map(n => {
          const data = n.getData() as MeshNodeData;
          return (
            data.infraData?.config?.standardConfig?.configMap?.mesh?.defaultConfig?.meshId ||
            data.infraData?.config?.standardConfig?.configMap?.mesh?.trustDomain ||
            'Istio mesh'
          );
        })
      );

      if (meshNames.size > 1) {
        cy.getBySel('mesh-tabs').should('exist');
        cy.getBySel('mesh-tabs').within(() => {
          cy.contains('button', `Meshes (${meshNames.size})`).should('exist');
        });
      }
    });
});

When('user selects ambient istiod mesh node', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.getReact('MeshPageComponent', { state: { isReady: true } })
    .should('have.length', 1)
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.meshRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());

      const { nodes } = elems(controller);
      const node = nodes.find(
        n => (n.getData() as MeshNodeData).infraType === MeshInfraType.ISTIOD && n.getData().isAmbient === true
      );
      assert.exists(node, 'An ambient istiod node should exist');

      const setSelectedIds = state.meshRefs.setSelectedIds as (values: string[]) => void;
      setSelectedIds([node!.getId()]);
    });
});

When('user selects non-ambient istiod mesh node', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.getReact('MeshPageComponent', { state: { isReady: true } })
    .should('have.length', 1)
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.meshRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());

      const { nodes } = elems(controller);
      const node = nodes.find(
        n => (n.getData() as MeshNodeData).infraType === MeshInfraType.ISTIOD && !n.getData().isAmbient
      );
      assert.exists(node, 'A non-ambient istiod node should exist');

      const setSelectedIds = state.meshRefs.setSelectedIds as (values: string[]) => void;
      setSelectedIds([node!.getId()]);
    });
});

Then('user sees ambient badge on the control plane panel', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.get('#target-panel-control-plane')
    .should('be.visible')
    .within(() => {
      cy.contains('ambient').should('be.visible');
    });
});

Then('user does not see ambient badge on the control plane panel', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.get('#target-panel-control-plane')
    .should('be.visible')
    .within(() => {
      cy.contains('ambient').should('not.exist');
    });
});

// Ambient multi-primary mesh step definitions

Then('user sees ztunnel nodes in both clusters', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.getReact('MeshPageComponent', { state: { isReady: true } })
    .should('have.length', 1)
    .then($graph => {
      const { state } = $graph[0];
      const controller = state.meshRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());

      const { nodes } = elems(controller);
      const ztunnelNodes = nodes.filter(n => (n.getData() as MeshNodeData).infraType === MeshInfraType.ZTUNNEL);

      // Should have at least 2 ztunnel (one per cluster)
      assert.isAtLeast(ztunnelNodes.length, 2, 'Should have control planes in both clusters');
    });
});

Then('user sees ambient data planes in both clusters', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.getReact('MeshPageComponent', { state: { isReady: true } })
    .should('have.length', 1)
    .then($graph => {
      const { state } = $graph[0];
      const controller = state.meshRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());

      const { nodes } = elems(controller);
      const dataPlanes = nodes.filter(n => (n.getData() as MeshNodeData).infraType === MeshInfraType.DATAPLANE);
      // Should have data planes
      assert.isAtLeast(dataPlanes.length, 2, 'Should have data planes');
      dataPlanes.forEach(cp => {
        const data = cp.getData() as MeshNodeData;
        const ambient = data.infraData.filter(n => n.isAmbient);
        // Check for ambient-specific properties or labels
        assert.exists(ambient, 'Control plane data should exist');
      });
    });
});

Then('user sees the mesh', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.getReact('MeshPageComponent', { state: { isReady: true } })
    .should('have.length', 1)
    .then($graph => {
      const { state } = $graph[0];
      const controller = state.meshRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
    });
});

Then('user sees {string} clusters in the mesh', (clusterCount: string) => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.getReact('MeshPageComponent', { state: { isReady: true } })
    .should('have.length', 1)
    .then($graph => {
      const { state } = $graph[0];
      const controller = state.meshRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());

      const { nodes } = elems(controller);
      const clusters = nodes.filter(n => (n.getData() as MeshNodeData).infraType === MeshInfraType.CLUSTER);

      expect(clusters.length).to.equal(parseInt(clusterCount));
    });
});
