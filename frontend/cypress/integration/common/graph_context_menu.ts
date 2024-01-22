import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { clusterParameterExists } from './navigation';
import { ensureKialiFinishedLoading } from './transition';

// Single cluster only.
When('user opens the context menu of the {string} service node', (svcName: string) => {
  ensureKialiFinishedLoading();
  cy.waitForReact();

  cy.getReact('CytoscapeGraph')
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const node = state.cy.nodes(`[nodeType="service"][service="${svcName}"]`);
      node.emit('cxttapstart');
      cy.wrap(node).as('contextNode');
    });
});

When(
  'user opens the context menu of the {string} service node on the {string} cluster',
  (svcName: string, cluster: string) => {
    ensureKialiFinishedLoading();

    cy.waitForReact();

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
        const node = state.cy.nodes(
          `[nodeType="service"][service="${svcName}"][cluster="${cluster}"][namespace="bookinfo"]`
        );
        expect(node.length).to.equal(1);
        node.emit('cxttapstart');
        cy.wrap(node).as('contextNode');
        cy.getBySel('graph-node-context-menu').should('be.visible');
      });
  }
);

When('user clicks the {string} item of the context menu', (menuKey: string) => {
  cy.get(`[data-test="graph-node-context-menu"] [data-test="${menuKey}"]`).then($item => {
    cy.wrap($item).click();
  });
});

When('user clicks the {string} action of the context menu', (actionKey: string) => {
  cy.get(`[data-test="graph-node-context-menu"] [data-test="${actionKey}_action"]`).then($item => {
    cy.wrap($item).click();
  });
});

Then('user should see the confirmation dialog to delete all traffic routing', () => {
  cy.get('[data-test=delete-traffic-routing-modal]').should('exist');
});

Then('user should see the {string} wizard', (wizardKey: string) => {
  cy.get(`[data-test=${wizardKey}_modal]`).should('exist');
});

Then('user should see {string} cluster parameter in links in the context menu', (exists: string) => {
  let present = true;

  if (exists === 'no') {
    present = false;
  }

  cy.get(`[data-test="graph-node-context-menu"]`).within(() => {
    clusterParameterExists(present);
  });
});

Then(
  'user should see the {string} cluster parameter in the {string} link in the context menu',
  (cluster: string, linkText: string) => {
    cy.get(`[data-test="graph-node-context-menu"]`).within(() => {
      cy.get('a').contains(linkText).should('have.attr', 'href').and('include', `clusterName=${cluster}`);
    });
  }
);

Then('configuration is duplicated to the {string} cluster', (cluster: string) => {
  cy.get('@contextNode').then((node: any) => {
    const namespace = node.data('namespace');
    const service = node.data('service');

    cy.fixture(`${service}-virtualservice.json`).then(virtualService => {
      cy.request({
        url: `api/namespaces/${namespace}/istio/virtualservices`,
        method: 'POST',
        qs: { clusterName: cluster },
        body: virtualService
      });
    });

    cy.fixture(`${service}-destinationrule.json`).then(destinationRule => {
      cy.request({
        url: `api/namespaces/${namespace}/istio/destinationrules`,
        method: 'POST',
        qs: { clusterName: cluster },
        body: destinationRule
      });
    });
  });
});
