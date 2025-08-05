import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { Visualization } from '@patternfly/react-topology';
import { MeshInfraType, MeshNodeData } from 'types/Mesh';
import { elems } from './graph';

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
        expect(resp.body.meshName).to.not.equal(undefined);
        expect(resp.body.meshName).to.not.equal('');
        cy.contains(`Mesh: ${resp.body.meshName}`);
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
    cy.get('div#graph-display-menu').find(`input#${option}`).check();
  } else {
    cy.get('div#graph-display-menu').find(`input#${option}`).uncheck();
  }
});

Then('user sees cluster side panel', () => {
  cy.waitForReact();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.get('#target-panel-cluster').should('be.visible');
});

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
    cy.get('#refresh_button').click();
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
      const minNodesLength = nodeNames.some(n => n === 'external deployments') ? 9 : 8;

      assert.isAtLeast(nodes.length, minNodesLength, 'Unexpected number of infra nodes');
      assert.isAtLeast(edges.length, 5, 'Unexpected number of infra edges');
      assert.isTrue(nodeNames.some(n => n === 'data plane'));
      assert.isTrue(nodeNames.some(n => n === 'grafana'));
      assert.isTrue(nodeNames.some(n => n.startsWith('istiod')));
      assert.isTrue(nodeNames.some(n => n === 'jaeger' || n === 'tempo'));
      assert.isTrue(nodeNames.some(n => n === 'kiali'));
      assert.isTrue(nodeNames.some(n => n === 'prometheus'));
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
  cy.get('.pf-v5-c-modal-box').should('be.visible');
  cy.contains('Configuration Tester').should('be.visible');
});

Then('user sees the Discovery and Tester tabs', () => {
  cy.get('.pf-v5-c-tabs__item').contains('Discovery').should('exist');
  cy.get('.pf-v5-c-tabs__item').contains('Tester').should('exist');
});

Then('user sees the action buttons fixed at the bottom', () => {
  cy.get('.pf-v5-c-modal-box__footer').should('be.visible');
  cy.get('.pf-v5-c-modal-box__footer').within(() => {
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
  cy.get('.pf-v5-c-modal-box').within(() => {
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
