import { When, Then } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';

When('the sidebar is open', () => {
  ensureKialiFinishedLoading();

  cy.get('#page-sidebar')
    .should('be.visible')
    .then($sidebar => {
      if ($sidebar.attr('aria-hidden') === 'true') {
        cy.get('#nav-toggle').click();
      }
    });

  cy.get('#page-sidebar').should('be.visible');
});

When('user presses the navigation toggle button', () => {
  cy.get('#nav-toggle').click();
});

Then('user cannot see the sidebar', () => {
  cy.get('#page-sidebar').should('not.be.visible');
});

When('the sidebar is closed', () => {
  ensureKialiFinishedLoading();

  cy.get('#page-sidebar')
    .should('be.visible')
    .then($sidebar => {
      if ($sidebar.attr('aria-hidden') === 'false') {
        cy.get('#nav-toggle').click();
      }
    });

  cy.get('#page-sidebar').should('not.be.visible');
});

Then('user sees the sidebar', () => {
  cy.get('#page-sidebar').should('be.visible');
});
