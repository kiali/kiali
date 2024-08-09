import { Then } from '@badeball/cypress-cucumber-preprocessor';
import { GraphDataSource } from '../../../src/services/GraphDataSource';

Then(`user does not see the {string} link`, link => {
  cy.get('div[role="dialog"]').get(`#${link}`).should('not.exist');
});

Then(`user see the {string} link`, link => {
  cy.get('div[role="dialog"]').get(`#${link}`).should('exist');
});

Then('the nodes located in the {string} cluster should be restricted', (cluster: string) => {
  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false } } })
    .should('have.length', '1')
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          const nodes = state.cy.nodes().filter(node => node.data('cluster') === cluster && !node.data('isBox'));
          nodes.forEach(node => {
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            expect(node.data('isInaccessible')).to.be.true;
          });
        });
    });
});

Then('the nodes on the minigraph located in the {string} cluster should be restricted', (cluster: string) => {
  cy.waitForReact();
  cy.getReact('MiniGraphCardComponent')
    .getProps('dataSource')
    .should((dataSource: GraphDataSource) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(dataSource.isLoading).to.be.false;
    })
    .then(() => {
      cy.getReact('CytoscapeGraph')
        .should('have.length', '1')
        .getCurrentState()
        .then(state => {
          const nodes = state.cy.nodes().filter(node => node.data('cluster') === cluster && !node.data('isBox'));
          nodes.forEach(node => {
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            expect(node.data('isInaccessible')).to.be.true;
          });
        });
    });
});
