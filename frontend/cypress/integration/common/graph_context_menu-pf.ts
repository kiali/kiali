import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';
import { Visualization } from '@patternfly/react-topology';
import { elems, selectAnd } from './graph-pf';
import { NodeAttr } from 'types/Graph';

// Single cluster only.
When('user opens the context menu of the {string} service node', (svcName: string) => {
  ensureKialiFinishedLoading();
  cy.waitForReact();
  cy.getReact('GraphPagePFComponent', { state: { isReady: true } })
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { nodes } = elems(controller);

      const node = selectAnd(nodes, [
        { prop: NodeAttr.nodeType, op: '=', val: 'service' },
        { prop: NodeAttr.service, op: '=', val: svcName }
      ]);

      cy.get(`[data-id=${node[0].getId()}]`).rightclick();
      cy.wrap(node[0]).as('contextNode');
    });
});

When(
  'user opens the context menu of the {string} service node on the {string} cluster',
  (svcName: string, cluster: string) => {
    ensureKialiFinishedLoading();
    cy.waitForReact();
    cy.getReact('GraphPagePFComponent', { state: { isReady: true } })
      .should('have.length', '1')
      .getCurrentState()
      .then(state => {
        const controller = state.graphRefs.getController() as Visualization;
        assert.isTrue(controller.hasGraph());
        const { nodes } = elems(controller);

        const node = selectAnd(nodes, [
          { prop: NodeAttr.nodeType, op: '=', val: 'service' },
          { prop: NodeAttr.service, op: '=', val: svcName },
          { prop: NodeAttr.cluster, op: '=', val: cluster },
          { prop: NodeAttr.namespace, op: '=', val: 'bookinfo' }
        ]);

        if (node.length === 0) {
          Cypress.$('[data-test="refresh-button"]').trigger('click');
          throw new Error(`service Node ${svcName} in namespace bookinfo in cluster ${cluster} not found`);
        }

        expect(node.length).to.equal(1);

        cy.get(`[data-id=${node[0].getId()}]`).rightclick();
        cy.wrap(node).as('contextNode');

        cy.getBySel('graph-node-context-menu').should('be.visible');
      });
  }
);

Then(
  'user should see no cluster parameter in the url when clicking the {string} link in the context menu',
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
  'user should see the {string} cluster parameter in the url when clicking the {string} link in the context menu',
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
    const namespace = node.getData().namespace;
    const service = node.getData().service;

    cy.fixture(`${service}-virtualservice.json`).then(virtualService => {
      cy.request({
        url: `api/namespaces/${namespace}/istio/networking.istio.io/v1/VirtualService`,
        method: 'POST',
        qs: { clusterName: cluster },
        body: virtualService
      });
    });

    cy.fixture(`${service}-destinationrule.json`).then(destinationRule => {
      cy.request({
        url: `api/namespaces/${namespace}/istio/networking.istio.io/v1/DestinationRule`,
        method: 'POST',
        qs: { clusterName: cluster },
        body: destinationRule
      });
    });
  });
});
