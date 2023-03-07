/*
  This file contains graph related step definitions
  that are common to multiple features.
*/

import { Then } from '@badeball/cypress-cucumber-preprocessor';

Then('user sees a minigraph', () => {
  cy.getBySel('mini-graph').within(() => {
    cy.get('#cytoscape-graph').should('be.visible');
    cy.get('#cy').should('be.visible');
  });
});
