import { Then, When } from '@badeball/cypress-cucumber-preprocessor';

When('user clicks the {string} {string} node', (svcName: string, nodeType: string) => {
  cy.waitForReact();
  cy.getReact('CytoscapeGraph')
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const node = state.cy.nodes(`[nodeType="${nodeType}"][${nodeType}="${svcName}"]`);
      node.emit('tap');
    });
});

When('user opens the kebab menu of the graph side panel', () => {
  cy.get('#summary-node-kebab').click();
});

When('user clicks the {string} item of the kebab menu of the graph side panel', (menuKey: string) => {
  cy.get(`#summary-node-actions [data-test="${menuKey}"]`).then($item => {
    cy.wrap($item).click();
  });
});

When('user clicks the {string} graph summary tab', (tab: string) => {
  cy.get('#graph_summary_tabs').should('be.visible').contains(tab).click();
});

Then('user should see {string} cluster parameter in links in the traces', (cluster: string) => {
  cy.getBySel('show-traces').click();
  cy.url().should('include', 'tab=traces');
  cy.url().should('include', `clusterName=${cluster}`);
});

Then('service badge for the graph side panel should be visible', () => {
  cy.get('#pfbadge-S').should('be.visible');
});

Then('user should see the traces tab not empty', () => {
  cy.get(`[data-test="traces-list"]`).should('be.visible');
});

When(
  'there is traffic routing for the {string} service in the {string} namespace and in the {string} cluster',
  (service: string, namespace: string, cluster: string) => {
    cy.request({
      url: `api/clusters/services?namespaces=${namespace}`,
      qs: { clusterName: cluster, istioResources: true, onlyDefinitions: false }
    }).then(response => {
      expect(response.status).to.eq(200);
      const svc = response.body.services.find(
        s => s.name === service && s.namespace === namespace && s.cluster === cluster
      );
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(svc).to.not.be.undefined;

      // If the VirtualService doesn't exist. Create it.
      cy.request({
        url: `api/namespaces/${namespace}/istio/virtualservices/${service}`,
        qs: { clusterName: cluster },
        failOnStatusCode: false
      }).then(response => {
        if (response.status === 404) {
          cy.log(`Creating VirtualService for ${service} service in namespace ${namespace} in cluster ${cluster}`);
          cy.fixture(`${service}-virtualservice.json`).then(virtualservice => {
            cy.request({
              url: `api/namespaces/${namespace}/istio/virtualservices`,
              method: 'POST',
              body: virtualservice,
              qs: { clusterName: cluster }
            }).then(response => {
              cy.log(`Response - status: ${response.status}, body: ${response.body}`);
              cy.wrap(response).its('status').should('eq', 200);
              // Refresh page to pickup new nodes.
              cy.reload();
            });
          });
        }
      });

      // If the DestionationRule doesn't exist. Create it.
      cy.request({
        url: `api/namespaces/${namespace}/istio/destinationrules/${service}`,
        qs: { clusterName: cluster },
        failOnStatusCode: false
      }).then(response => {
        if (response.status === 404) {
          cy.log(`Creating DestinationRule for ${service} service in namespace ${namespace} in cluster ${cluster}`);
          cy.fixture(`${service}-destinationrule.json`).then(dr => {
            cy.request({
              url: `api/namespaces/${namespace}/istio/destinationrules`,
              method: 'POST',
              body: dr,
              qs: { clusterName: cluster }
            }).then(response => {
              cy.log(`Response - status: ${response.status}, body: ${response.body}`);
              cy.wrap(response).its('status').should('eq', 200);
              // Refresh page to pickup new nodes.
              cy.reload();
            });
          });
        }
      });
    });
  }
);

When(
  'user clicks the {string} service node in the {string} namespace in the {string} cluster',
  (service: string, namespace: string, cluster: string) => {
    cy.waitForReact();
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
  }
);

Then('the side panel links should contain a {string} parameter', (parameter: string) => {
  cy.get('#graph-side-panel').within(() => {
    cy.get('a').should('have.attr', 'href').and('include', parameter);
  });
});

Then('{string} cluster badge for the graph side panel should be visible', (cluster: string) => {
  cy.get('#graph-side-panel').within(() => {
    cy.get('#pfbadge-C').should('be.visible').parent().parent().contains(cluster);
  });
});

When('user chooses to delete the routing', () => {
  cy.get('@contextNode').then(node => {
    const cluster = node.data('cluster');
    const service = node.data('service');
    const namespace = node.data('namespace');
    cy.log(`Deleting traffic routing for ${service} service in namespace ${namespace}, data: ${node.data()}`);
    cy.intercept({
      pathname: `**/api/namespaces/${namespace}/istio/virtualservices/${service}`,
      method: 'DELETE',
      query: { clusterName: cluster }
    }).as('delete-vs');
    cy.intercept({
      pathname: `**/api/namespaces/${namespace}/istio/destinationrules/${service}`,
      method: 'DELETE',
      query: { clusterName: cluster }
    }).as('delete-dr');

    cy.getBySel('confirm-delete').click();

    cy.wait('@delete-vs').its('response.statusCode').should('eq', 200);
    cy.wait('@delete-dr').its('response.statusCode').should('eq', 200);
  });
});

Then(
  'there is no traffic routing for the {string} service in the {string} namespace and in the {string} cluster',
  (service: string, namespace: string, cluster: string) => {
    cy.request({
      url: `api/clusters/services?namespaces=${namespace}`,
      qs: { clusterName: cluster, istioResources: true, onlyDefinitions: false }
    }).then(response => {
      cy.wrap(response).its('status').should('eq', 200);
      const svc = response.body.services.find(
        s => s.name === service && s.namespace === namespace && s.cluster === cluster
      );
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(svc).to.not.be.undefined;
      // If the VirtualService doesn't exist. Create it.
      // If the DestionationRule doesn't exist. Create it.
      if (
        svc.istioReferences.some(
          o => o.objectType === 'VirtualService' && o.name === service && o.namespace === namespace && o.cluster === ''
        )
      ) {
        cy.log(`Deleting VirtualService for ${service} service in namespace ${namespace} in cluster ${cluster}`);
        cy.request({
          url: `api/namespaces/${namespace}/istio/virtualservices/${service}`,
          method: 'DELETE',
          qs: { clusterName: cluster }
        }).then(response => {
          cy.wrap(response).its('status').should('eq', 200);
          // If anything got deleted then refresh the page to pickup the latest changes.
          cy.reload();
        });
      }

      if (
        svc.istioReferences.some(
          o => o.objectType === 'DestinationRule' && o.name === service && o.namespace === namespace && o.cluster === ''
        )
      ) {
        cy.log(`Deleting DestinationRule for ${service} service in namespace ${namespace} in cluster ${cluster}`);
        cy.request({
          url: `api/namespaces/${namespace}/istio/destinationrules/${service}`,
          method: 'DELETE',
          qs: { clusterName: cluster }
        }).then(response => {
          cy.wrap(response).its('status').should('eq', 200);
          // If anything got deleted then refresh the page to pickup the latest changes.
          cy.reload();
        });
      }
    });
  }
);

Then(
  'user does not see traffic routing objects for the {string} service in the {string} namespace in the {string} cluster',
  (service: string, namespace: string, cluster: string) => {
    // Wait for the table to load in.
    cy.get('table').should('not.contain.text', 'No Istio config found');
    cy.getBySel(`VirtualItem_Cluster${cluster}_Ns${namespace}_virtualservice_${service}`).should('not.exist');
    cy.getBySel(`VirtualItem_Cluster${cluster}_Ns${namespace}_destinationrule_${service}`).should('not.exist');
  }
);

Then(
  'user sees traffic routing objects for the {string} service in the {string} namespace in the {string} cluster',
  (service: string, namespace: string, cluster: string) => {
    // Wait for the table to load in.
    cy.get('table').should('not.contain.text', 'No Istio config found');
    cy.getBySel(`VirtualItem_Cluster${cluster}_Ns${namespace}_virtualservice_${service}`).should('exist');
    cy.getBySel(`VirtualItem_Cluster${cluster}_Ns${namespace}_destinationrule_${service}`).should('exist');
  }
);

When('user adds a route rule', () => {
  cy.getBySel('add-route').click();
});
