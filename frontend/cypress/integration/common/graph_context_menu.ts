import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { clusterParameterExists } from './navigation';

When('user opens the context menu of the {string} service node', (svcName: string) => {
  cy.waitForReact();

  cy.getReact('CytoscapeGraph')
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const node = state.cy.nodes(`[nodeType="service"][service="${svcName}"]`);
      node.emit('cxttapstart');
    });
});

When('user clicks the {string} item of the context menu', (menuKey: string) => {
  cy.get(`[data-test="graph-node-context-menu"] [data-test="${menuKey}"]`).then($item => {
    cy.wrap($item).click();
  });
});

When('user clicks the {string} action of the context menu', (actionKey: string) => {
  cy.get(`[data-test="graph-node-context-menu"] [data-test="${actionKey}_action"]`).then($item => {
    cy.wrap($item).click();
  });
});

Then('user should see the confirmation dialog to delete all traffic routing', () => {
  cy.get('[data-test=delete-traffic-routing-modal]').should('exist');
});

Then('user should see the {string} wizard', (wizardKey: string) => {
  cy.get(`[data-test=${wizardKey}_modal]`).should('exist');
});

Then('user should see {string} cluster parameter in links in the context menu', (exists: string) => {
  let present = true;

  if (exists === 'no') {
    present = false;
  }

  cy.get(`[data-test="graph-node-context-menu"]`).within(() => {
    clusterParameterExists(present);
  });
});
