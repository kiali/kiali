import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { Visualization } from '@patternfly/react-topology';
import { elems, selectAnd } from './graph';
import { NodeAttr } from 'types/Graph';

const WIZARD_TITLES: Record<string, string> = {
  request_routing: 'Request Routing',
  fault_injection: 'Fault Injection',
  traffic_shifting: 'Traffic Shifting',
  tcp_traffic_shifting: 'TCP Traffic Shifting',
  request_timeouts: 'Request Timeouts',
  k8s_request_routing: 'K8s HTTP Routing',
  k8s_grpc_request_routing: 'K8s GRPC Routing'
};

const VIEW_ONLY_TOOLTIP = 'No user permission or Kiali in view-only mode';

// Single cluster only.
When('user opens the context menu of the {string} service node', (svcName: string) => {
  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false }, isReady: true } })
    .should('have.length', '1')
    .then($graph => {
      const { state } = $graph[0];

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
    cy.waitForReact();
    cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false }, isReady: true } })
      .should('have.length', '1')
      .then($graph => {
        const { state } = $graph[0];

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
        cy.wrap(node[0]).as('contextNode');

        cy.get('.pf-topology-context-menu__c-dropdown__menu').should('be.visible');
      });
  }
);

When('user clicks the {string} item of the context menu', (menuKey: string) => {
  // Create-actions are added asynchronously after service-detail fetch; the menu remounts
  // and detaches any prior subject. Re-query the item on each retry and prefer the
  // inner button (PF6 DropdownItem puts data-test on the wrapper).
  cy.get(`[data-test="${menuKey}"]`, { timeout: 15000 })
    .should('be.visible')
    .should('not.have.class', 'pf-m-disabled')
    .then($el => {
      const $btn = $el.is('button') ? $el : $el.find('button');
      cy.wrap($btn.length ? $btn : $el).click({ force: true });
    });
});

Then('user should see the {string} wizard', (wizardKey: string) => {
  cy.get(`[data-test=${wizardKey}_modal]`).should('exist');
});

Then('user should see the read-only YAML preview for the {string} action', (wizardKey: string) => {
  const title = `View ${WIZARD_TITLES[wizardKey]}`;

  cy.get('.pf-v6-c-modal-box')
    .last()
    .within(() => {
      cy.contains(title).should('be.visible');
      cy.contains('Copy').should('be.visible');
      cy.contains('Download').should('be.visible');
      cy.get('.monaco-editor').should('exist');
      cy.contains('button', 'Close').should('be.visible');
    });
});

Then('user should see the {string} item of the context menu disabled in view-only mode', (menuKey: string) => {
  cy.get('.pf-topology-context-menu__c-dropdown__menu')
    .find(`[data-test="${menuKey}"]`)
    .should('have.class', 'pf-m-disabled')
    .find('button')
    .should('be.disabled')
    .parent()
    .parent()
    .as('disabledMenuItem');

  cy.get('@disabledMenuItem').trigger('mouseover', { force: true });
  cy.get('@disabledMenuItem').trigger('mouseenter', { force: true });

  cy.get('[role="tooltip"]').should('be.visible').and('contain', VIEW_ONLY_TOOLTIP);
});

Then('user should see the {string} item of the context menu enabled in view-only mode', (menuKey: string) => {
  cy.get('.pf-topology-context-menu__c-dropdown__menu')
    .find(`[data-test="${menuKey}"]`)
    .should('not.have.class', 'pf-m-disabled')
    .find('button')
    .should('not.be.disabled');
});

Then('user should see the confirmation dialog to delete all traffic routing', () => {
  cy.get('[data-test=delete-traffic-routing-modal]').should('exist');
});

Then(
  'user should see no cluster parameter in the url when clicking the {string} link in the context menu',
  (linkText: string) => {
    cy.get('.pf-topology-context-menu__c-dropdown__menu').within(() => {
      cy.get('button').contains(linkText).click();
    });
    cy.url().should('not.include', 'clusterName=');
    cy.go('back');
  }
);

Then(
  'user should see the {string} cluster parameter in the url when clicking the {string} link in the context menu',
  (cluster: string, linkText: string) => {
    cy.get('.pf-topology-context-menu__c-dropdown__menu').within(() => {
      cy.get('button').contains(linkText).click();
    });
    cy.url().should('include', `clusterName=${cluster}`);
    cy.go('back');
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
