import { Then, When } from '@badeball/cypress-cucumber-preprocessor';

When('user opens the context menu of the {string} service node', function (svcName: string) {
  cy.waitForReact();
  cy.getReact('CytoscapeGraph')
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const node = state.cy.nodes(`[nodeType="service"][service="${svcName}"]`);
      node.emit('cxttapstart');
    });
});

When('user clicks the {string} item of the context menu', function (menuKey: string) {
  cy.get(`[data-test="graph-node-context-menu"] [data-test="${menuKey}"]`).then($item => {
    cy.wrap($item).click();
  });
});

When('user clicks the {string} action of the context menu', function (actionKey: string) {
  cy.get(`[data-test="graph-node-context-menu"] [data-test="${actionKey}_action"]`).then($item => {
    cy.wrap($item).click();
  });
});

Then('user should see the confirmation dialog to delete all traffic routing', function () {
  cy.get('[data-test=delete-traffic-routing-modal]').should('exist');
});

Then('user should see the {string} wizard', function (wizardKey: string) {
  cy.get(`[data-test=${wizardKey}_modal]`).should('exist');
});