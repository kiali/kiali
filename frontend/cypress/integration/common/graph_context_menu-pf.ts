import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';

// Single cluster only.
When('user opens the context menu of the {string} service node in the patternfly graph', (svcName: string) => {
  ensureKialiFinishedLoading();
  cy.waitForReact();

  cy.getReact('GraphPagePFComponent', { state: { graphData: { isLoading: false } } })
    .should('have.length', '1')
    .then(() => {
      cy.getReact('GraphPF').should('have.length', '1');
      cy.get('.pf-topology__node__label').contains(svcName).parent().find('.pf-topology__node__action-icon').click();
      cy.waitForReact();
    });
});

When(
  'user opens the context menu of the {string} service node on the {string} cluster in the patternfly graph',
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

Then(
  'user should see no cluster parameter in the url when clicking the {string} link in the context menu in the patternfly graph',
  (linkText: string) => {
    cy.get(`.pf-topology-context-menu__c-dropdown__menu`).within(() => {
      cy.get('button')
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
  'user should see the {string} cluster parameter in the url when clicking the {string} link in the context menu in the patternfly graph',
  (cluster: string, linkText: string) => {
    cy.get(`.pf-topology-context-menu__c-dropdown__menu`).within(() => {
      cy.get('button')
        .contains(linkText)
        .click()
        .then(() => {
          cy.url().should('include', `clusterName=${cluster}`);
          cy.go('back');
        });
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
