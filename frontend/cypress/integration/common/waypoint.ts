import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { openTab } from './transition';

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

Then('the user sees the {string} option in the pod tooltip, and is {string}', (option: string, value: string) => {
  cy.get(`[data-test=pod-info]`).trigger('mouseenter');
  cy.get('[role="tooltip"]').should('be.visible').and('contain', option);
  cy.get('[role="tooltip"]').should('be.visible').and('contain', value);
  cy.get(`[data-test=pod-info]`).trigger('mouseleave');
});

Then('the user sees the {string} badge', (name: string) => {
  cy.get(`#pfbadge-${name}`).should('exist').contains(name);
});

Then('the proxy status is {string}', (status: string) => {
  cy.get('[data-label=Status]').get(`.icon-${status}`).should('exist');
});

Then('the user can see the {string} istio config and badge {string}', (config: string, badge: string) => {
  cy.get('#IstioConfigCard').should('be.visible').get(`[data-test="${config}"]`).should('exist');
  cy.get('#IstioConfigCard').should('be.visible').get(`#${badge}`).should('exist');
});

Then('the proxy status is {string} with {string} details', (status: string, detail: string) => {
  cy.get('[test-data=proxy-status]').get(`.icon-${status}`).should('exist');
  cy.get('[test-data=proxy-status]').trigger('mouseenter');
  cy.get('[role="tooltip"]').should('be.visible').and('contain', detail);
  cy.get(`[data-test=pod-info]`).trigger('mouseleave');
});

Then('the user goes to the {string} tab', (tab: string) => {
  openTab(tab);
});

Then('user goes to the waypoint {string} subtab', (subtab: string) => {
  cy.get('#waypoint-details').should('be.visible').contains(subtab).click();
});

Then('validates Services data', () => {
  cy.get('[data-test="enrolled-data-title"]').should('be.visible');
  cy.get('[role="grid"]').should('be.visible').get('[data-label="Name"]').and('contain', 'productpage-v1');
  cy.get('[role="grid"]').should('be.visible').get('#pfbadge-S').should('exist');
  cy.get('[role="grid"]').should('be.visible').get('[data-label="Namespace"]').and('contain', 'bookinfo');
  cy.get('[role="grid"]').should('be.visible').get('[data-label="Labeled by"]').and('contain', 'namespace');
});

Then('validates waypoint Info data', () => {
  cy.get('[data-test=waypointfor-title]').should('exist').and('contain', 'service');
  cy.get('[role="grid"]').should('be.visible').get('[data-label=RDS]').and('contain', 'IGNORED');
});

When('the user validates the Ztunnel tab', () => {
  openTab('Ztunnel');
  cy.get('#ztunnel-details').should('be.visible').contains('Services').click();
  cy.get('[role="grid"]').should('be.visible').get('[data-label="Service VIP"]');
  cy.get('[role="grid"]').should('be.visible').get('[data-label=Waypoint]');
  cy.get('[role="grid"]').should('be.visible').get('[data-label=Namespace]').and('contain', 'bookinfo');
  cy.get('#ztunnel-details').should('be.visible').contains('Workloads').click();
  cy.get('[role="grid"]').should('be.visible').get('[data-label="Pod Name"]');
  cy.get('[role="grid"]').should('be.visible').get('[data-label=Node]');
  cy.get('[role="grid"]').should('be.visible').get('[data-label=Namespace]').and('contain', 'bookinfo');
});
