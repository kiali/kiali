import { And, Then } from '@badeball/cypress-cucumber-preprocessor';
import { colExists } from './table';

And("cluster badge for {string} cluster should be visible",(cluster:string) => {
  cy.get("#pfbadge-C").parent().contains(cluster).should("be.visible");
});

And("user sees {string} from a remote {string} cluster",(type:string, cluster:string) => {
  cy.waitForReact();
  cy.getReact('CytoscapeGraph')
  .should('have.length', '1')
  .getCurrentState()
  .then(state => {
    const apps = state.cy.nodes(`[cluster="${cluster}"][nodeType="${type}"][namespace="bookinfo"]`).length; 
    assert.isAbove(apps,0);
  });
})

And ("user should see columns related to cluster info for the inbound and outbound traffic", () => {
  colExists("Cluster",true, 2);
})

Then('user sees details information for the remote {string} app', (name:string) => {
  cy.getBySel('app-description-card').within(() => {
    cy.get('#pfbadge-A').parent().parent().contains(`${name}`); // App
    cy.get('#pfbadge-W').parent().parent().contains(`${name}-v1`); // Workload
    cy.get('#service-list').contains('No services found');
    
  });
});
