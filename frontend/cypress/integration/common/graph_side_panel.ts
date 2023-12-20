import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { clusterParameterExists } from './navigation';

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

Then('user should see {string} cluster parameter in links in the traces', (exists: string) => {
  let present = true;

  if (exists === 'no') {
    present = false;
  }

  cy.get(`[data-test="show-traces"]`).within(() => {
    clusterParameterExists(present);
  });
});

Then('service badge for the graph side panel should be visible', () => {
  cy.get('#pfbadge-S').should('be.visible');
});

Then('user should see the traces tab not empty', () => {
  cy.get(`[data-test="traces-list"]`).should('be.visible');
});
