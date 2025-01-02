import { Then } from '@badeball/cypress-cucumber-preprocessor';

// waitForWorkloadEnrolled waits until Kiali returns the namespace labels updated
// Adding the waypoint label into the bookinfo namespace
// This is usually enough (Slower) to have the workloads enrolled
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
        return waitForWorkloadEnrolled(maxRetries, retryCount + 1);
      });
    }
  });
};

const waitForBookinfoWaypointTrafficGeneratedInGraph = (maxRetries = 30, retryCount = 0): void => {
  if (retryCount >= maxRetries) {
    throw new Error(`Condition not met after ${maxRetries} retries`);
  }

  cy.request({
    method: 'GET',
    url:
      '/api/namespaces/graph?duration=60s&graphType=versionedApp&includeIdleEdges=false&injectServiceNodes=true&boxBy=cluster,namespace,app&waypoints=false&ambientTraffic=waypoint&appenders=deadNode,istio,serviceEntry,meshCheck,workloadEntry,health,ambient&rateGrpc=requests&rateHttp=requests&rateTcp=sent&namespaces=bookinfo'
  }).then(response => {
    expect(response.status).to.equal(200);
    const elements = response.body.elements;

    if (elements?.edges?.length > 10) {
      return;
    } else {
      return cy.wait(10000).then(() => {
        return waitForBookinfoWaypointTrafficGeneratedInGraph(maxRetries, retryCount + 1);
      });
    }
  });
};

Then('{string} namespace is labeled with the waypoint label', (namespace: string) => {
  cy.exec(`kubectl label namespace ${namespace} istio.io/use-waypoint=waypoint`, { failOnNonZeroExit: false });
  waitForWorkloadEnrolled();
});

Then('the graph page has enough data', () => {
  waitForBookinfoWaypointTrafficGeneratedInGraph();
});

Then('the user hovers in the {string} label and sees {string} in the tooltip', (label: string, text: string) => {
  cy.get(`[data-test=workload-description-card]`).contains('span', label).trigger('mouseenter');
  cy.get('[role="tooltip"]').should('be.visible').and('contain', text);
  cy.get(`[data-test=workload-description-card]`).contains('span', label).trigger('mouseleave');
});

Then('the user sees the L7 {string} link', (waypoint: string) => {
  cy.get(`[data-test=waypoint-list]`).contains('span', 'L7');
  cy.get(`[data-test=waypoint-link]`).contains('a', waypoint);
});

Then('the link for the waypoint {string} should redirect to a valid workload details', (waypoint: string) => {
  cy.get(`[data-test=waypoint-link]`).contains('a', waypoint).click();
  cy.get(`[data-test=workload-description-card]`).contains('h5', waypoint);
});
