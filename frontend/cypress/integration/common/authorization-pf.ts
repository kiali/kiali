import { Then } from '@badeball/cypress-cucumber-preprocessor';
import { elems } from './graph-pf';
import { Visualization } from '@patternfly/react-topology';

Then(`user does not see the {string} link`, link => {
  cy.get('div[role="dialog"]').find(`#${link}`).should('not.exist');
});

Then(`user see the {string} link`, link => {
  cy.get('div[role="dialog"]').find(`#${link}`).should('exist');
});

Then('the nodes located in the {string} cluster should be restricted', (cluster: string) => {
  cy.waitForReact();
  cy.getReact('GraphPagePFComponent', { state: { isReady: true } })
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
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
  cy.getReact('MiniGraphCardPFComponent', { state: { isReady: true } })
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
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
