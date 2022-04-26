import { And, When } from 'cypress-cucumber-preprocessor/steps';
import { getColWithRowText } from './table';

And('the {string} row is visible', (row: string) => {
  cy.get('table').contains('td', row);
});

And('the health column on the {string} row has a health icon', (row: string) => {
  getColWithRowText(row, 'Health').find(
    'svg[class=icon-healthy], svg[class=icon-unhealthy], svg[class=icon-degraded], svg[class=icon-na]'
  );
});

And('user filters for service type {string}', (serviceType: string) => {
  cy.get('button[aria-label="Options menu"]').click();
  cy.contains('button', serviceType).click();
});

And('user filters for sidecar {string}', (sidecarState: string) => {
  cy.get('select[aria-label="filter_select_value"]').select(sidecarState);
});

And('user filters for health {string}', (health: string) => {
  cy.get('select[aria-label="filter_select_value"]').select(health);
});

And('user should only see healthy services in the table', () => {
  cy.get('tbody').within(() => {
    cy.get('svg[class=icon-healthy]').should('be.visible');
    cy.get('svg[class=icon-unhealthy], svg[class=icon-degraded], svg[class=icon-na]').should('not.exist');
  });
});

When('user filters for label {string}', (label: string) => {
  cy.get('input[aria-label="filter_input_label_key"]').type(`${label}{enter}`);
});
