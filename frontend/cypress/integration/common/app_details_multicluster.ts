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
    assert.equal(apps, 1);
  });
})

And ("user should see a column related to cluster info", () => {
  colExists("Cluster",true, 2);
})