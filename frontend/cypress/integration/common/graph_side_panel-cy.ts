import { When } from '@badeball/cypress-cucumber-preprocessor';

When('user clicks the {string} {string} node in the cytoscape graph', (svcName: string, nodeType: string) => {
  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
    .should('have.length', '1')
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          const node = state.cy.nodes(`[nodeType="${nodeType}"][${nodeType}="${svcName}"]`);
          node.emit('tap');
        });
    });
});

When(
  'user clicks the edge from {string} {string} to {string} {string} in the cytoscape graph',
  (svcName: string, nodeType: string, destSvcName: string, destNodeType: string) => {
    cy.waitForReact();
    cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
      .should('have.length', '1')
      .then(() => {
        cy.getReact('CytoscapeGraph')
          .should('have.length', '1')
          .getCurrentState()
          .then(state => {
            const node = state.cy.nodes(`[nodeType="${nodeType}"][${nodeType}="${svcName}"]`);
            const destNode = state.cy.nodes(`[nodeType="${destNodeType}"][${destNodeType}="${destSvcName}"]`);
            const edge = state.cy.edges(`[source="${node.id()}"][target="${destNode.id()}"]`);

            edge.emit('tap');
          });
      });
  }
);

When(
  'user clicks the {string} service node in the {string} namespace in the {string} cluster in the cytoscape graph',
  (service: string, namespace: string, cluster: string) => {
    cy.waitForReact();
    cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
      .should('have.length', '1')
      .then(() => {
        cy.getReact('CytoscapeGraph')
          .should('have.length', '1')
          .getCurrentState()
          .then($graph => {
            const serviceNode = $graph.cy
              .nodes()
              .filter(
                node =>
                  node.data('nodeType') === 'service' &&
                  node.data('isBox') === undefined &&
                  node.data('service') === service &&
                  node.data('namespace') === namespace &&
                  node.data('cluster') === cluster
              );
            expect(serviceNode.length).to.equal(1);
            cy.wrap(serviceNode.emit('tap')).then(() => {
              // Wait for the side panel to change.
              // Note we can't use summary-graph-panel since that
              // element will get unmounted and disappear when
              // the context changes but the graph-side-panel does not.
              cy.get('#graph-side-panel').contains(service);
              cy.wrap(serviceNode).as('contextNode');
            });
          });
      });
  }
);

When('user chooses to delete the routing in the cystoscape graph', () => {
  cy.get('@contextNode').then(node => {
    const cluster = node.data('cluster');
    const service = node.data('service');
    const namespace = node.data('namespace');
    cy.log(`Deleting traffic routing for ${service} service in namespace ${namespace}, data: ${node.data()}`);
    cy.intercept({
      pathname: `**/api/namespaces/${namespace}/istio/networking.istio.io/v1/VirtualService/${service}`,
      method: 'DELETE',
      query: { clusterName: cluster }
    }).as('delete-vs');
    cy.intercept({
      pathname: `**/api/namespaces/${namespace}/istio/networking.istio.io/v1/DestinationRule/${service}`,
      method: 'DELETE',
      query: { clusterName: cluster }
    }).as('delete-dr');

    cy.getBySel('confirm-delete').click();

    cy.wait('@delete-vs').its('response.statusCode').should('eq', 200);
    cy.wait('@delete-dr').its('response.statusCode').should('eq', 200);
  });
});
