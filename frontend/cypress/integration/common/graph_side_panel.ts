import { And, When } from '@badeball/cypress-cucumber-preprocessor';
import { clusterParameterExists } from "./navigation";

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

When('user clicks the {string} graph summary tab', function (tab: string) {
  cy.get('#graph_summary_tabs').should('be.visible').contains(tab).click();
});

When('user clicks the Show Traces button', function () {
  cy.get('button[data-test="show-traces"]').click()
});

And('user should see {string} cluster parameter in links in the context menu',(exists:string)=>{
  var present:boolean = true;
  if (exists === 'no'){
    present = false;
  }
  cy.get(`[data-test="show-traces"]`).within(() => {
    clusterParameterExists(present);
  });
})
