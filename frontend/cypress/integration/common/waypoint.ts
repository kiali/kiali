import { Then } from '@badeball/cypress-cucumber-preprocessor';

const waitForWorkloadEnrolled = (maxRetries = 30, retryCount = 0): Cypress.Chainable => {
  if (retryCount >= maxRetries) {
    throw new Error(`Condition not met after ${maxRetries} retries`);
  }
  return cy
    .exec('istioctl ztunnel-config workload | egrep productpage')
    .its('stdout')
    .then(output => {
      if (output.includes('waypoint')) {
        return;
      } else {
        cy.wait(10000);
        return waitForWorkloadEnrolled(maxRetries, retryCount + 1);
      }
    });
};

Then('{string} namespace is labeled with the waypoint label', (namespace: string) => {
  cy.exec(`kubectl label namespace ${namespace} istio.io/use-waypoint=waypoint`, { failOnNonZeroExit: false });
  waitForWorkloadEnrolled();
});

Then('the user hovers in the {string} label and sees {string} in the tooltip', (label: string, text: string) => {
  cy.get(`[data-test=workload-description-card]`).contains('span', label).trigger('mouseenter');
  cy.get('[role="tooltip"]').should('be.visible').and('contain', text);
});
