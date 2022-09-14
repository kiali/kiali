import { When, Then, And, DataTable } from '@badeball/cypress-cucumber-preprocessor';

Then('user can see all of the Help dropdown options', (options: DataTable) => {
  const names = options.raw()[0];
  names.forEach(function (value) {
    cy.get('li[role="menuitem"]').contains(value).should('be.visible');
  });
});

And('the {string} button has a link', (title: string) => {
  cy.get('li[role="menuitem"]').contains(title).should('have.attr', 'href');
});

When('user clicks on the {string} button', (title: string) => {
  cy.get('li[role="menuitem"]').contains(title).click();
});

Then('user sees the {string} modal', (title: string) => {
  cy.get('h1.pf-c-modal-box__title').contains(title).should('be.visible');
});
