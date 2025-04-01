import { Then } from '@badeball/cypress-cucumber-preprocessor';
import { elems } from './graph';
import { Visualization } from '@patternfly/react-topology';
import { GraphDataSource } from 'services/GraphDataSource';

Then(`user does not see the {string} link`, link => {
  cy.get('div[role="dialog"]').find(`#${link}`).should('not.exist');
});

Then(`user see the {string} link`, link => {
  cy.get('div[role="dialog"]').find(`#${link}`).should('exist');
});

Then('the nodes located in the {string} cluster should be restricted', (cluster: string) => {
  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false }, isReady: true } })
    .should('have.length', '1')
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { nodes } = elems(controller);

      const filteredNodes = nodes.filter(node => node.getData().cluster === cluster && !node.getData().isBox);

      filteredNodes.forEach(node => {
        assert.isTrue(node.getData().isInaccessible);
      });
    });
});

Then('the nodes on the minigraph located in the {string} cluster should be restricted', (cluster: string) => {
  cy.waitForReact();
  cy.getReact('MiniGraphCardComponent', { state: { isReady: true, isLoading: false } })
    .should('have.length', '1')
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { nodes } = elems(controller);

      const filteredNodes = nodes.filter(node => node.getData().cluster === cluster && !node.getData().isBox);

      filteredNodes.forEach(node => {
        assert.isTrue(node.getData().isInaccessible);
      });
    });
});

Then(
  'user sees the {string} Istio Config objects and not the {string} Istio Config Objects',
  (cluster: string, externalCluster: string) => {
    cy.getBySel(`VirtualItem_Cluster${cluster}_Nsbookinfo_VirtualService_bookinfo`).contains(
      'td[data-label="Cluster"]',
      'east'
    );
    cy.getBySel(`VirtualItem_Cluster${externalCluster}_Nsbookinfo_VirtualService_bookinfo`).should('not.exist');
  }
);

Then('user sees the forbidden error message', () => {
  cy.get('div[id="empty-page-error"]').should('exist').contains('No Istio object is selected');
});
