import { Then } from '@badeball/cypress-cucumber-preprocessor';
import { GraphDataSource } from 'services/GraphDataSource';

Then(`user does not see the {string} link`, link => {
  cy.get('div[role="dialog"]').get(`#${link}`).should('not.exist');
});

Then(`user see the {string} link`, link => {
  cy.get('div[role="dialog"]').get(`#${link}`).should('exist');
});

Then('the nodes located in the {string} cluster should be restricted', (cluster: string) => {
  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
    .should('have.length', '1')
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          const nodes = state.cy.nodes().filter(node => node.data('cluster') === cluster && !node.data('isBox'));
          nodes.forEach(node => {
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            expect(node.data('isInaccessible')).to.be.true;
          });
        });
    });
});

Then('the nodes on the minigraph located in the {string} cluster should be restricted', (cluster: string) => {
  cy.waitForReact();
  cy.getReact('MiniGraphCardComponent')
    .getProps('dataSource')
    .should((dataSource: GraphDataSource) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(dataSource.isLoading).to.be.false;
    })
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          const nodes = state.cy.nodes().filter(node => node.data('cluster') === cluster && !node.data('isBox'));
          nodes.forEach(node => {
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            expect(node.data('isInaccessible')).to.be.true;
          });
        });
    });
});

Then(
  'user sees the {string} Istio Config objects and not the {string} Istio Config Objects',
  (cluster: string, externalCluster: string) => {
    cy.getBySel(`VirtualItem_Clustereast_Nsbookinfo_virtualservice_bookinfo`).contains(
      'td[data-label="Cluster"]',
      'east'
    );
    cy.getBySel(`VirtualItem_Clusterwest_Nsbookinfo_virtualservice_bookinfo`).should('not.exist');
  }
);

Then('user sees the forbidden error message', () => {
  cy.get('div[id="empty-page-error"]').should('exist').contains('No Istio object is selected');
});
