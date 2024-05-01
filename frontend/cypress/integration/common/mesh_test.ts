import { Before, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { Controller, Edge, Node, isEdge, isNode } from '@patternfly/react-topology';

const url = '/console';

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

When(
  'user asks for mesh with refresh {string} and duration {string}',
  (namespaces: string, refresh: string, duration: string) => {
    cy.visit(`${url}/mesh?refresh=${refresh}&duration=${duration}&namespaces=${namespaces}`);
  }
);

When('user opens mesh tour', () => {
  cy.get('button#mesh-tour').click();
});

When('user closes mesh tour', () => {
  cy.get('div[role="dialog"]').find('button[aria-label="Close"]').click();
});

Then('user {string} mesh tour', (action: string) => {
  if (action === 'sees') {
    cy.get('div[role="dialog"]').find('span').contains('Shortcuts').should('exist');
  } else {
    cy.get('div[role="dialog"]').should('not.exist');
  }
});

When('user clicks mesh duration menu', () => {
  cy.get('button#time_range_duration-toggle').click();
});

When(`user selects mesh duration {string}`, (duration: string) => {
  cy.get('button#time_range_duration-toggle').click();
  cy.get(`button[id="${duration}"]`).click();
  cy.get('#loading_kiali_spinner').should('not.exist');
});

When('user clicks mesh refresh menu', () => {
  cy.get('button#time_range_refresh-toggle').click();
});

When(`user selects mesh refresh {string}`, (refresh: string) => {
  cy.get('button#time_range_refresh-toggle').click();
  cy.get(`button[id="${refresh}"]`).click().get('#loading_kiali_spinner').should('not.exist');
});

Then('mesh side panel is shown', () => {
  cy.get('#target-panel-mesh')
    .should('be.visible')
    .within(div => {
      cy.contains('Mesh Name: Istio Mesh');
    });
});

Then('user sees expected mesh infra', () => {
  //cy.get('#loading_kiali_spinner').should('not.exist');
  cy.waitForReact();
  cy.getReact('MeshPageComponent')
    .should('have.length', '2')
    .nthNode(1)
    .getCurrentState()
    .then(state => {
      const controller = state.controller;
      assert.isTrue(controller.hasGraph());
      const { nodes, edges } = elems(controller);
      assert.equal(nodes.length, 8, 'Unexpected number of infra nodes');
      assert.equal(edges.length, 5, 'Unexpected number of infra edges');
    });
});

// Since I can't import from MeshElems.tsx, copying some helpers here...
const elems = (c: Controller): { edges: Edge[]; nodes: Node[] } => {
  const elems = c.getElements();

  return {
    nodes: elems.filter(e => isNode(e)) as Node[],
    edges: elems.filter(e => isEdge(e)) as Edge[]
  };
};
