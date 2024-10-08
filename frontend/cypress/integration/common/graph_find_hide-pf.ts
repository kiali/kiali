import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { Controller, Edge, isEdge, isNode, Visualization, Node } from '@patternfly/react-topology';

const clearFindAndHide = (): void => {
  cy.get('#graph_hide').clear();
  cy.get('#graph_find').clear();
};

Then('user finds unhealthy workloads', () => {
  clearFindAndHide();

  cy.get('#graph_find').type('!healthy{enter}');
});

Then('user sees unhealthy workloads highlighted on the graph', () => {
  const expectedUnhealthyNodes = [
    {
      app: 'v-server',
      version: 'v1',
      namespace: 'alpha'
    },
    {
      app: 'w-server',
      version: 'v1',
      namespace: 'alpha'
    },
    {
      app: 'w-server',
      version: undefined, // Service does not have version
      namespace: 'alpha'
    }
  ];
  cy.waitForReact();
  cy.getReact('GraphPagePFComponent', { state: { isReady: true } })
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { nodes } = elems(controller);
      const unhealthyNodes = nodes
        .filter(n => n.getData().isFind)
        .map(n => ({
          app: n.getData().app,
          version: n.getData().version,
          namespace: n.getData().namespace
        }));
      assert.includeDeepMembers(unhealthyNodes, expectedUnhealthyNodes, 'Unexpected unhealthy nodes');
    });
});

Then('user sees nothing highlighted on the graph', () => {
  cy.waitForReact();
  cy.getReact('GraphPagePFComponent', { state: { isReady: true } })
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { nodes } = elems(controller);
      const filteredNodes = nodes.filter(n => n.getData().isFind);
      assert.equal(filteredNodes.length, 0, 'Unexpected number of highlighted nodes');
    });
});

const elems = (c: Controller): { edges: Edge[]; nodes: Node[] } => {
  const elems = c.getElements();

  return {
    nodes: elems.filter(e => isNode(e)) as Node[],
    edges: elems.filter(e => isEdge(e)) as Edge[]
  };
};

When('user hides unhealthy workloads', () => {
  clearFindAndHide();

  cy.get('#graph_hide').type('!healthy{enter}');
});

Then('user sees no unhealthy workloads on the graph', () => {
  cy.waitForReact();
  cy.getReact('GraphPagePFComponent', { state: { isReady: true } })
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { nodes } = elems(controller);
      const visibleNodes = nodes.filter(n => n.isVisible());
      const noUnhealthyNodes = visibleNodes.every(
        node => node.getData().healthStatus !== 'Failure' || node.getData().nodeType === 'box'
      );
      assert.equal(noUnhealthyNodes, true, 'Unhealthy nodes are still visible');
    });
});

Then('user sees preset find options', () => {
  cy.getBySel('find-options-dropdown').click();
  cy.contains('Find: unhealthy nodes');
});

When('user selects the preset the find option {string}', (option: string) => {
  cy.get('#graph-find-presets').contains(option).click();
});

Then('user sees preset hide options', () => {
  cy.getBySel('hide-options-dropdown').click();
  cy.contains('Hide: healthy nodes');
});

When('user selects the preset hide option {string}', (option: string) => {
  cy.get('#graph-hide-presets').contains(option).click();
});

Then('user sees no healthy workloads on the graph', () => {
  cy.waitForReact();
  cy.getReact('GraphPagePFComponent', { state: { isReady: true } })
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { nodes } = elems(controller);
      const visibleNodes = nodes.filter(n => n.isVisible());
      const noUnhealthyNodes = visibleNodes.every(
        node => node.getData().healthStatus !== 'Healthy' || node.getData().nodeType === 'box'
      );
      assert.equal(noUnhealthyNodes, true, 'Unhealthy nodes are still visible');
    });
});

When('user seeks help for find and hide', () => {
  cy.getBySel('graph-find-hide-help-button').should('be.visible').click();
});

Then('user sees the help menu', () => {
  cy.getBySel('graph-find-hide-help').should('be.visible');
});

Then('the help menu has info on {string}', (helpMenuItem: string) => {
  cy.get('#graph_find_help_tabs').contains(helpMenuItem).should('be.visible');
});

When('user fills {string} in find and submits', (input: string) => {
  cy.get('#graph_find').type(`${input}{enter}`);
});

Then('user sees the {string} message', (error: string) => {
  cy.get('[aria-label="graph settings"]').should('contain.text', error);
});
