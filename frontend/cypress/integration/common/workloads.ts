import { And, Then } from 'cypress-cucumber-preprocessor/steps';

And('user filters for workload type {string}', (workloadType: string) => {
    cy.get('select[aria-label="filter_select_type"]').parent().within(() => {
      cy.get('button').click();
      cy.get(`button[label="${workloadType}"]`).click();
    });
  });

Then('user sees {string} in the table', (workload: string) => {
  cy.get('tbody').within(() => {
    if (workload === 'no workloads') {
      cy.contains('No workloads found');
    } else if (workload === 'workloads') {
      cy.contains('No workloads found').should('not.exist');
    } else {
      cy.contains('td', workload);
    }
  });
});