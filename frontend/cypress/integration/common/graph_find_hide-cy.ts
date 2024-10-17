import { Then } from '@badeball/cypress-cucumber-preprocessor';

Then('user sees unhealthy workloads highlighted on the cytoscape graph', () => {
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
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
    .should('have.length', '1')
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          const unhealthyNodes = state.cy
            .nodes()
            .filter((node: any) => node.classes().includes('find'))
            .map((node: any) => ({
              app: node.data('app'),
              version: node.data('version'),
              namespace: node.data('namespace')
            }));
          expect(unhealthyNodes).to.include.deep.members(expectedUnhealthyNodes);
        });
    });
});

Then('user sees nothing highlighted on the cytoscape graph', () => {
  cy.contains('Loading Graph').should('not.exist');

  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
    .should('have.length', '1')
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          expect(state.cy.nodes().filter((node: any) => node.classes().includes('find')).length).to.equal(0);
        });
    });
});

Then('user sees no unhealthy workloads on the cytoscape graph', () => {
  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
    .should('have.length', '1')
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          const noUnhealthy = state.cy
            .nodes()
            // Unhealthy boxes are fine.
            .every((node: any) => node.data('healthStatus') !== 'Failure' || node.data('nodeType') === 'box');

          expect(noUnhealthy).to.equal(true);
        });
    });
});

Then('user sees no healthy workloads on the cytoscape graph', () => {
  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
    .should('have.length', '1')
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          const noHealthy = state.cy
            .nodes()
            .every((node: any) => node.data('healthStatus') !== 'Healthy' || node.data('nodeType') === 'box');

          expect(noHealthy).to.equal(true);
        });
    });
});
