import { Then } from '@badeball/cypress-cucumber-preprocessor';

const waitForWorkloadEnrolled = (maxRetries = 30, retryCount = 0): void => {
  if (retryCount >= maxRetries) {
    throw new Error(`Condition not met after ${maxRetries} retries`);
  }

  cy.request({ method: 'GET', url: '/api/namespaces' }).then(response => {
    expect(response.status).to.equal(200);

    const ns = response.body;
    let found = false;

    ns.forEach(namespace => {
      if (namespace.name === 'bookinfo') {
        const labels = namespace.labels;
        Object.keys(labels).forEach(key => {
          if (labels[key] === 'waypoint') {
            found = true;
            return;
          }
        });
      }
    });

    if (found) {
      return;
    } else {
      return cy.wait(10000).then(() => {
        return waitForWorkloadEnrolled(maxRetries, retryCount + 1); // Ensure to return the recursive call
      });
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
