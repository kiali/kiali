import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';

// Single cluster only.
When('user opens the context menu of the {string} service node in the cytoscape graph', (svcName: string) => {
  ensureKialiFinishedLoading();
  cy.waitForReact();

  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
    .should('have.length', '1')
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          const node = state.cy.nodes(`[nodeType="service"][service="${svcName}"]`);
          node.emit('cxttapstart');
          cy.wrap(node).as('contextNode');
        });
    });
});

When(
  'user opens the context menu of the {string} service node on the {string} cluster in the cytoscape graph',
  (svcName: string, cluster: string) => {
    ensureKialiFinishedLoading();
    cy.waitForReact();
    cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
      .should('have.length', '1')
      .then(() => {
        cy.getReact('CytoscapeGraph')
          .should('have.length', '1')
          .getCurrentState()
          // Using should we can retry until the node is found.
          // It could be that a node has not yet appeared on the traffic map
          // because traffic hasn't made it to the node yet. So, we retry
          // and refresh the traffic map until it shows up.
          .should(state => {
            const node = state.cy.nodes(
              `[nodeType="service"][service="${svcName}"][cluster="${cluster}"][namespace="bookinfo"]`
            );
            if (node.length === 0) {
              Cypress.$('[data-test="refresh-button"]').trigger('click');
              throw new Error(`service Node ${svcName} in namespace bookinfo in cluster ${cluster} not found`);
            }
            expect(node.length).to.equal(1);
          })
          .then(state => {
            // Wait for the last "click" to finish before continuing.
            ensureKialiFinishedLoading();
            const node = state.cy.nodes(
              `[nodeType="service"][service="${svcName}"][cluster="${cluster}"][namespace="bookinfo"]`
            );
            expect(node.length).to.equal(1);
            node.emit('cxttapstart');
            cy.wrap(node).as('contextNode');
            cy.getBySel('graph-node-context-menu').should('be.visible');
          });
      });
  }
);

When('user clicks the {string} item of the context menu in the cytoscape graph', (menuKey: string) => {
  cy.get(`[data-test="graph-node-context-menu"] [data-test="${menuKey}"]`).then($item => {
    cy.wrap($item).click();
  });
});

When('user clicks the {string} action of the context menu in the cytoscape graph', (actionKey: string) => {
  cy.get(`[data-test="graph-node-context-menu"] [data-test="${actionKey}_action"]`).then($item => {
    cy.wrap($item).click();
  });
});

Then('user should see the {string} wizard', (wizardKey: string) => {
  cy.get(`[data-test=${wizardKey}_modal]`).should('exist');
});

Then('user should see the confirmation dialog to delete all traffic routing', () => {
  cy.get('[data-test=delete-traffic-routing-modal]').should('exist');
});

Then(
  'user should see no cluster parameter in the url when clicking the {string} link in the context menu in the cytoscape graph',
  (linkText: string) => {
    cy.get(`[data-test="graph-node-context-menu"]`).within(() => {
      cy.get('a')
        .contains(linkText)
        .click()
        .then(() => {
          cy.url().should('not.include', 'clusterName=');
          cy.go('back');
        });
    });
  }
);

Then(
  'user should see the {string} cluster parameter in the url when clicking the {string} link in the context menu in the cytoscape graph',
  (cluster: string, linkText: string) => {
    cy.get(`[data-test="graph-node-context-menu"]`).within(() => {
      cy.get('a')
        .contains(linkText)
        .click()
        .then(() => {
          cy.url().should('include', `clusterName=${cluster}`);
          cy.go('back');
        });
    });
  }
);
