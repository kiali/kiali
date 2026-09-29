import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { clickGraphNode, findGraphNode, selectAnd } from './graph';
import { NodeAttr } from 'types/Graph';

const openServiceContextMenu = (nodeFilter: Parameters<typeof findGraphNode>[0], errorMsg: string): void => {
  findGraphNode(nodeFilter, errorMsg).then(node => {
    clickGraphNode(node.getId(), { rightClick: true });
    cy.wrap(node).as('contextNode');
    cy.get('.pf-topology-context-menu__c-dropdown__menu').should('be.visible');
  });
};

// Single cluster only.
When('user opens the context menu of the {string} service node', (svcName: string) => {
  openServiceContextMenu(
    nodes =>
      selectAnd(nodes, [
        { prop: NodeAttr.nodeType, op: '=', val: 'service' },
        { prop: NodeAttr.service, op: '=', val: svcName }
      ]),
    `service Node ${svcName} not found`
  );
});

When(
  'user opens the context menu of the {string} service node on the {string} cluster',
  (svcName: string, cluster: string) => {
    openServiceContextMenu(
      nodes =>
        selectAnd(nodes, [
          { prop: NodeAttr.nodeType, op: '=', val: 'service' },
          { prop: NodeAttr.service, op: '=', val: svcName },
          { prop: NodeAttr.cluster, op: '=', val: cluster },
          { prop: NodeAttr.namespace, op: '=', val: 'bookinfo' }
        ]),
      `service Node ${svcName} in namespace bookinfo in cluster ${cluster} not found`
    );
  }
);

When('user clicks the {string} item of the context menu', (menuKey: string) => {
  cy.get('.pf-topology-context-menu__c-dropdown__menu')
    .find(`[data-test="${menuKey}"]`)
    .then($item => {
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
  'user should see no cluster parameter in the url when clicking the {string} link in the context menu',
  (linkText: string) => {
    cy.get('.pf-topology-context-menu__c-dropdown__menu').within(() => {
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
    cy.get('.pf-topology-context-menu__c-dropdown__menu').within(() => {
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
