import { Then } from '@badeball/cypress-cucumber-preprocessor';
import { assertGraphReady, assertMiniGraphReady } from './graph';

Then(`user does not see the {string} link`, link => {
  cy.get('div[role="dialog"]').find(`#${link}`).should('not.exist');
});

Then(`user see the {string} link`, link => {
  cy.get('div[role="dialog"]').find(`#${link}`).should('exist');
});

Then('the nodes located in the {string} cluster should be restricted', (cluster: string) => {
  assertGraphReady(({ nodes }) => {
    const filteredNodes = nodes.filter(node => node.getData().cluster === cluster && !node.getData().isBox);

    filteredNodes.forEach(node => {
      assert.isTrue(node.getData().isInaccessible);
    });
  });
});

Then('the nodes on the minigraph located in the {string} cluster should be restricted', (cluster: string) => {
  assertMiniGraphReady(({ nodes }) => {
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
