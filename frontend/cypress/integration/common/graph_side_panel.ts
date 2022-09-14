import { When } from '@badeball/cypress-cucumber-preprocessor';

When('user clicks the {string} service node', function (svcName: string) {
  cy.waitForReact();
  cy.getReact('CytoscapeGraph')
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const node = state.cy.nodes(`[nodeType="service"][service="${svcName}"]`);
      node.emit('tap');
    });
});

When('user opens the kebab menu of the graph side panel', function () {
  cy.get('#summary-node-kebab').click();
});

When('user clicks the {string} item of the kebab menu of the graph side panel', function (menuKey: string) {
  cy.get(`#summary-node-actions [data-test="${menuKey}"]`).then($item => {
    cy.wrap($item).click();
  });
});
