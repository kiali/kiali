import { Before, Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';

const url = '/console';

const CLUSTER1_CONTEXT = Cypress.env('CLUSTER1_CONTEXT');
const CLUSTER2_CONTEXT = Cypress.env('CLUSTER2_CONTEXT');

Before(() => {
  // Forcing to not stop cypress on unexpected errors not related to the tests.
  // There are some random failures due timeouts/loadtime/framework that throws some error in the browser.
  // After reviewing the tests failures, those are unrelated to the app, so,
  // it needs this event to not fail the CI action due some "slow" action or similar.
  // This is something to review in future iterations when tests are solid, but I haven't found a better way to
  // solve this issue.
  cy.on('uncaught:exception', (err, runnable, promise) => {
    // when the exception originated from an unhandled promise
    // rejection, the promise is provided as a third argument
    // you can turn off failing the test in this case
    if (promise) {
      return false;
    }
    // we still want to ensure there are no other unexpected
    // errors, so we let them fail the test
  });
});

Given('user opens the namespace {string} and {string} service details page', (namespace: string, service: string) => {
  // Forcing "Pause" to not cause unhandled promises from the browser when cypress is testing
  cy.visit(`${url}/namespaces/${namespace}/services/${service}?refresh=0`);
});

Given(
  'user opens the namespace {string} and the {string} {string} service details page',
  (namespace: string, cluster:string, service: string) => {
    cy.visit(`${url}/namespaces/${namespace}/services/${service}?refresh=0&clusterName=${cluster}`);
  }
);

When(
  'user deletes Request Routing named {string} and the resource is no longer available in any cluster',
  (name: string) => {
    cy.exec(`kubectl delete destinationrules.networking.istio.io ${name} -n bookinfo --context ${CLUSTER1_CONTEXT}`, {
      failOnNonZeroExit: false
    });

    cy.exec(`kubectl delete destinationrules.networking.istio.io ${name} -n bookinfo --context ${CLUSTER2_CONTEXT}`, {
      failOnNonZeroExit: false
    });

    cy.exec(`kubectl delete virtualservices.networking.istio.io ${name} -n bookinfo --context ${CLUSTER1_CONTEXT}`, {
      failOnNonZeroExit: false
    });

    cy.exec(`kubectl delete virtualservices.networking.istio.io ${name} -n bookinfo --context ${CLUSTER2_CONTEXT}`, {
      failOnNonZeroExit: false
    });

    ensureKialiFinishedLoading();
  }
);

When('user deletes gateway named {string} and the resource is no longer available in any cluster', (name: string) => {
  cy.exec(`kubectl delete gateway.networking.istio.io ${name} -n bookinfo --context ${CLUSTER1_CONTEXT}`, {
    failOnNonZeroExit: false
  });

  cy.exec(`kubectl delete gateway.networking.istio.io ${name} -n bookinfo --context ${CLUSTER2_CONTEXT}`, {
    failOnNonZeroExit: false
  });

  ensureKialiFinishedLoading();
});

When('user clicks in the {string} actions', (action: string) => {
  let actionId = '';

  switch (action) {
    case 'Request Routing':
      actionId = 'request_routing';
      break;
    case 'K8s Gateway API Routing':
      actionId = 'k8s_request_routing';
      break;
    case 'Delete Traffic Routing':
      actionId = 'delete_traffic_routing';
      break;
  }

  it('spinner should disappear', { retries: 3 }, () => {
    cy.get('#loading_kiali_spinner').should('not.exist');
  });

  cy.get('button[data-test="service-actions-toggle"]')
    .should('exist')
    .click()
    .get('#loading_kiali_spinner')
    .should('not.exist');

  cy.get(`li[data-test="${actionId}"]`)
    .find('button')
    .should('exist')
    .click()
    .get('#loading_kiali_spinner')
    .should('not.exist');
});

Then('user sees the generated {string} objects located in the {string} cluster', (svc: string, cluster: string) => {
  cy.getBySel(`VirtualItem_Cluster${cluster}_Nsbookinfo_destinationrule_${svc}`)
    .find('[data-label="Cluster"]')
    .contains(cluster);

  cy.getBySel(`VirtualItem_Cluster${cluster}_Nsbookinfo_virtualservice_${svc}`)
    .find('[data-label="Cluster"]')
    .contains(cluster);
});

Then(
  'the {string} {string} should be listed in {string} {string} namespace',
  (type: string, svc: string, cluster: string, ns: string) => {
    cy.getBySel(`VirtualItem_Cluster${cluster}_Ns${ns}_${type.toLowerCase()}_${svc}`)
      .find('[data-label="Cluster"]')
      .contains(cluster);
  }
);

When('user sees the {string} wizard', (title: string) => {
  cy.get(`div[aria-label="${title}"]`);
});

When('user clicks in the {string} tab', (tab: string) => {
  cy.get(`button[data-test="${tab}"]`).click();
});

When('user clicks in the {string} request matching dropdown', (select: string) => {
  cy.get('button[data-test="requestmatching-header-toggle"]').click();

  cy.get(`li[data-test="requestmatching-header-${select}"]`).find('button').click();
});

When('user clicks in the {string} request filtering dropdown', (select: string) => {
  cy.get('button[data-test="filtering-type-toggle"]').click();

  cy.get(`li[data-test="filtering-type-${select}"]`).find('button').click();
});

When('user types {string} in the matching header input', (header: string) => {
  cy.get('input[id="header-name-id"]').type(header);
});

When('user types {string} in the filtering header input', (header: string) => {
  cy.get('input[id="filter-header-name-id"]').type(header);
});

When('user clicks in the {string} match value dropdown', (value: string) => {
  cy.get('button[data-test="requestmatching-match-toggle"]').click();

  cy.get(`li[data-test="requestmatching-match-${value}"]`).find('button').click();
});

When('user types {string} in the match value input', (value: string) => {
  cy.get('input[id="match-value-id"]').type(value);
});

When('user adds a match', () => {
  cy.get('button[data-test="add-match"]').click();
});

When('user adds a filter', () => {
  cy.get('button[data-test="add-filter"]').click();
});

When('user types {string} traffic weight in the {string} workload', (weight: string, workload: string) => {
  cy.get(`input[data-test="input-slider-${workload}"]`).type(weight, { force: true });
});

When('user adds a route', () => {
  cy.get('button[data-test="add-route"]').click();
});

When('user clicks in {string} matching selected', (match: string) => {
  cy.get(`span[data-test="${match}"]`)
    .children()
    .first() // div wrapper
    .children()
    .first() // button
    .click();
});

When('user previews the configuration', () => {
  cy.get('button[data-test="preview"]').click();
});

When('user creates the configuration', () => {
  cy.get('button[data-test="create"]').click();

  cy.get('button[data-test="confirm-create"]').click();

  it('spinner should disappear', { retries: 3 }, () => {
    cy.get('#loading_kiali_spinner').should('not.exist');
  });
});

When('user updates the configuration', () => {
  cy.get('button[data-test="update"]').click();

  cy.get('button[data-test="confirm-update"]').click();

  it('spinner should disappear', { retries: 3 }, () => {
    cy.get('#loading_kiali_spinner').should('not.exist');
  });
});

When('user confirms delete the configuration', () => {
  cy.get('button[data-test="confirm-delete"]').click();

  it('spinner should disappear', { retries: 3 }, () => {
    cy.get('#loading_kiali_spinner').should('not.exist');
  });
});

Then('user sees the {string} {string} {string} reference', (namespace: string, name: string, type: string) => {
  cy.get(`a[data-test="${type}-${namespace}-${name}"]`);
});

When('user clicks in the {string} {string} {string} reference', (namespace: string, name: string, type: string) => {
  cy.get(`a[data-test="${type}-${namespace}-${name}"]`).click();

  let expectedURl = '';

  switch (type) {
    case 'destinationrule':
      expectedURl = `/namespaces/${namespace}/istio/destinationrules/${name}`;
      break;
    case 'service':
      expectedURl = `/namespaces/${namespace}/services/${name}`;
      break;
    case 'virtualservice':
      expectedURl = `/namespaces/${namespace}/istio/virtualservices/${name}`;
      break;
  }

  cy.location('pathname').should('include', expectedURl);
});

Then('user sees the {string} regex in the editor', (regexContent: string) => {
  const re = new RegExp(regexContent);

  cy.get('.ace_content').invoke('text').should('match', re);
});

When('user clicks on {string} Advanced Options', (action: string) => {
  cy.get(`div[id="${action.toLowerCase()}_advanced_options"]`).prev().click();
});

When('user clicks on Add Gateway', () => {
  cy.get('input[id="advanced-gwSwitch"]').next().click();
});

When('user selects Create Gateway', () => {
  cy.get('input[id="createGateway"]').click();
});
