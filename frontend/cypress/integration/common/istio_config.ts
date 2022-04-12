import { And, When } from 'cypress-cucumber-preprocessor/steps';

And('user filters for config {string}', (configName: string) => {
  cy.get('select[aria-label="filter_select_value"]').select(configName);
});

When('the user clicks the actions button', () => {
  cy.getBySel('actions-dropdown').click();
});

And('the user clicks the create {string} action', (action: string) => {
  cy.getBySel('actions-dropdown').within(() => {
    cy.contains(action).click();
  });
});
