/*
  This file has step definitions for the apps list page as well as
  step definitions that are shared between app, workload, and service
  pages since these are all similar.
*/

import { Given, Then, When, Step } from '@badeball/cypress-cucumber-preprocessor';
import {
  checkHealthIndicatorInTable,
  checkHealthStatusInTable,
  colExists,
  ensureObjectsInTable,
  getColWithRowText
} from './table';
import { hasAtLeastOneClass, linkSelector } from './utils';
import { openTab, waitForKialiApiReady } from './transition';
import { enableKialiFeature, HEALTH_CACHE_CONFIG, HEALTH_STATUS_METRIC_CONFIG } from './kiali-config';

// Type definition for health cache metrics API response
interface HealthCacheMetrics {
  healthCacheHits: number;
  healthCacheMisses: number;
}

// Choosing a random bookinfo app to test with.
const APP = 'details';
const CLUSTER1_CONTEXT = Cypress.env('CLUSTER1_CONTEXT');
const CLUSTER2_CONTEXT = Cypress.env('CLUSTER2_CONTEXT');

// Helper function to wait for an app to reach a specific health status
const waitForAppHealthStatus = (
  namespace: string,
  app: string,
  expectedStatus: string,
  timeoutMs = 90000
): Cypress.Chainable => {
  const startTime = Date.now();
  const pollInterval = 5000; // Check every 5 seconds

  const checkHealth = (): Cypress.Chainable => {
    return cy
      .request({
        url: `api/namespaces/${namespace}/apps/${app}?health=true`,
        failOnStatusCode: false
      })
      .then(response => {
        if (response.status !== 200) {
          cy.log(`Health API returned ${response.status}, retrying...`);
          if (Date.now() - startTime < timeoutMs) {
            cy.wait(pollInterval);
            return checkHealth();
          } else {
            throw new Error(`Timeout waiting for app ${app} health API to be available`);
          }
        }

        const actualStatus = response.body?.health?.status?.status;
        cy.log(`App ${app} health status: ${actualStatus} (expecting ${expectedStatus})`);

        if (actualStatus === expectedStatus) {
          cy.log(`✓ App ${app} reached ${expectedStatus} status`);
          return cy.wrap(response.body);
        } else if (Date.now() - startTime < timeoutMs) {
          cy.wait(pollInterval);
          return checkHealth();
        } else {
          throw new Error(
            `Timeout after ${timeoutMs}ms: App ${app} in namespace ${namespace} never reached ${expectedStatus} status. Last status: ${actualStatus}`
          );
        }
      });
  };

  return checkHealth();
};

Given('a healthy application in the cluster', function () {
  this.targetNamespace = 'bookinfo';
  this.targetApp = 'details';
});

// When you use this, you need to annotate test by @sleep-app-scaleup-after to revert this change after the test
Given('an idle sleep application in the cluster', function () {
  this.targetNamespace = 'sleep';
  this.targetApp = 'sleep';

  cy.exec('kubectl scale -n sleep --replicas=0 deployment/sleep');

  waitForAppHealthStatus(this.targetNamespace, this.targetApp, 'Not Ready');
});

Given('a failing application in the mesh', function () {
  this.targetNamespace = 'alpha';
  this.targetApp = 'v-server';

  // Wait for the app to actually be in Failure state before proceeding
  waitForAppHealthStatus(this.targetNamespace, this.targetApp, 'Failure');
});

Given('a degraded application in the mesh', function () {
  this.targetNamespace = 'alpha';
  this.targetApp = 'b-client';

  // Wait for the app to actually be in Degraded state before proceeding
  waitForAppHealthStatus(this.targetNamespace, this.targetApp, 'Degraded');
});

Then('user sees trace information', () => {
  openTab('Traces');

  cy.getBySel('tracing-scatterplot');

  // Ensures a trace hasn't been clicked on yet.
  cy.getBySel('trace-details-tabs').should('not.exist');

  // Ensures traces have loaded.
  cy.getBySel('tracing-scatterplot').contains('Traces');
});

Then('user see no traces', () => {
  openTab('Traces');

  cy.getBySel('tracing-scatterplot').should('not.exist');

  // Ensures traces have loaded.
  cy.getBySel('empty-traces').contains('No trace results');
});

Then('user sees trace details', () => {
  cy.getBySel('trace-details-tabs').should('be.visible');
  cy.getBySel('trace-details-kebab').click();
  cy.getBySel('trace-details-dropdown').contains('View on Graph');
});

When('user hovers over a trace with at least {int} spans', (spans: number) => {
  cy.getBySel('tracing-scatterplot').within(() => {
    // Victory can render points in an initial transient position before settling them.
    // Give the scatter plot a moment to stabilize before resolving the target point.
    cy.wait(5000);
    cy.waitForReact();
    cy.getReact('*oint', { props: { symbol: 'circle' } })
      .should('have.length.at.least', 1)
      .then(($points: any) => {
        const pointWithTraceName = $points.filter(point => point.props?.datum?.trace?.spans.length >= spans)[0];
        const dataPointInGraph = pointWithTraceName.children[0].props.d;

        cy.get(`path[d="${dataPointInGraph}"]`)
          .should('be.visible')
          .trigger('mouseover', { force: true })
          .trigger('mouseenter', { force: true })
          .trigger('mousemove', { force: true });
      });
  });
});

Then('user sees the tracing tooltip heat map', () => {
  cy.getBySel('trace-tooltip', { timeout: 10000 }).should('be.visible');
  cy.getBySel('trace-tooltip-heatmap', { timeout: 20000 }).should('be.visible');
  cy.getBySel('trace-tooltip-heatmap-area').should('not.contain', 'n/a');
  cy.getBySel('trace-tooltip').find('[role="progressbar"]').should('not.exist');
});

When('user selects a trace', function () {
  Step(this, 'user selects a trace with at least 0 spans');
});

When('user selects a trace with at least {int} spans', (spans: number) => {
  cy.getBySel('tracing-scatterplot').within(() => {
    cy.waitForReact();
    // This changed from Point to point_Point with the pf6 update.
    // Very confusingly it is still Point when you run against the dev server
    // but it is point_Point when you run against the prod build.
    // Also there are ChartPoint which match *oint so we need to filter on the symbol.
    // Even more aggravating is the fact that *Point doesn't match Point so that's why it's *oint.
    // TODO: Find a more reliable way to do this.
    cy.getReact('*oint', { props: { symbol: 'circle' } })
      .should('have.length.at.least', 1)
      .then(($points: any) => {
        // We want to find a point that has all of the specified number of spans loaded
        // since some of the later assertions look for a certain number of spans.
        // There doesn't seem to be a good way to inject a data-test attribute into individual points
        // on the graph so here we are looking at the react state of the points and then finding one
        // that matches the exact data path.
        const pointWithTraceName = $points.filter(point => point.props?.datum?.trace?.spans.length >= spans)[0];
        const dataPointInGraph = pointWithTraceName.children[0].props.d;
        cy.get(`path[d="${dataPointInGraph}"]`).should('be.visible').click({ force: true });
      });
  });
});

Then('user sees span details', () => {
  cy.getBySel('trace-details-tabs').should('be.visible').contains('Span Details').click({ scrollBehavior: false });

  cy.get('table', { timeout: 5000 })
    .should('exist')
    .find('tbody tr') // ignore thead rows
    .should('have.length.above', 1) // retries above cy.find() until we have a non head-row
    .eq(1) // take 1st  row
    .find('td')
    .eq(4) // take 5th cell (kebab)
    .should('exist');

  cy.get('table', { timeout: 5000 })
    .should('exist')
    .find('tbody tr') // ignore thead rows
    .should('have.length.above', 1) // retries above cy.find() until we have a non head-row
    .eq(1) // take 1st  row
    .find('td')
    .eq(3) // take 4th cell (Statistics)
    .children('button')
    .should('not.exist'); // Load Statistics button should not exist when metrics are loaded
});

When('I fetch the list of applications', () => {
  cy.visit({ url: '/console/applications?refresh=0' });
});

When('user opens the namespace dropdown', () => {
  cy.intercept(`**/api/namespaces/`).as('getNamespaces');
  cy.get('[data-test="namespace-dropdown"]').click();
});

Then('user sees Health information for Apps', () => {
  getColWithRowText(APP, 'Health')
    .find('span')
    .filter('.pf-v6-c-icon')
    .should('satisfy', hasAtLeastOneClass(['icon-healthy', 'icon-unhealthy', 'icon-degraded', 'icon-na']));
});

Then('user sees all the Apps in the bookinfo namespace', () => {
  ensureObjectsInTable('details', 'kiali-traffic-generator', 'productpage', 'ratings', 'reviews');
});

Then('user sees Name information for Apps', () => {
  // There should be a table with a heading for each piece of information.
  getColWithRowText(APP, 'Name').within(() => {
    cy.get(linkSelector(`/namespaces/bookinfo/applications/${APP}`)).should('be.visible');
  });
});

Then('user sees Namespace information for Apps', () => {
  getColWithRowText(APP, 'Namespace').contains('bookinfo');
});

Then('user sees Labels information for Apps', () => {
  getColWithRowText(APP, 'Labels').contains('app=details');
  getColWithRowText(APP, 'Labels').contains('service=details');
  getColWithRowText(APP, 'Labels').contains('version=v1');
});

Then('user sees Details information for Apps', () => {
  getColWithRowText(APP, 'Details').within(() => {
    cy.contains('bookinfo-gateway');

    cy.get(linkSelector('/namespaces/bookinfo/istio/networking.istio.io/v1/Gateway/bookinfo-gateway')).should(
      'be.visible'
    );
  });
});

Then('user only sees the apps with the {string} name', (name: string) => {
  let count: number;

  cy.request({ method: 'GET', url: `/api/clusters/apps` }).should(response => {
    count = response.body.applications.filter(item => item.name.includes(name)).length;
  });

  cy.get('tbody').within(() => {
    cy.contains('No apps found').should('not.exist');
    cy.get('tr').should('have.length', count);
  });
});

// This is somewhat vague because there's no guarantee that all the bookinfo apps are
// going to be healthy when the test is run but at least some of them should be.
Then('user only sees healthy apps', () => {
  cy.get('tbody').within(() => {
    cy.get('tr')
      .find('span')
      .filter('.pf-v6-c-icon')
      .should('satisfy', hasAtLeastOneClass(['icon-healthy']));
  });
});

Then('the application should be listed as {string}', function (healthStatus: string) {
  checkHealthIndicatorInTable(this.targetNamespace, null, this.targetApp, healthStatus);
});

Then('the health status of the application should be {string}', function (healthStatus: string) {
  checkHealthStatusInTable(this.targetNamespace, null, this.targetApp, healthStatus);
});

Then('user sees all the Apps toggles', () => {
  cy.get('[data-test="toggle-health"]').should('be.checked');
  cy.get('[data-test="toggle-istioResources"]').should('be.checked');

  colExists('Health', true);
  colExists('Details', true);
});

When('user {string} toggle {string}', (action: 'checks' | 'unchecks', toggle: string) => {
  if (action === 'checks') {
    cy.get(`[data-test="toggle-${toggle}"]`).check();
  } else {
    cy.get(`[data-test="toggle-${toggle}"]`).uncheck();
  }
});

Then('the {string} column {string}', (col: string, action: 'appears' | 'disappears') => {
  colExists(col, action === 'appears');
});

Then('user may only see {string}', (sees: string) => {
  cy.get('tbody').within(() => {
    cy.get('tr').should('have.length', 1);

    cy.get('td').then(td => {
      if (td.length === 1) {
        cy.get('h5').contains('No applications found');
      } else {
        cy.contains('tr', sees);
      }
    });
  });
});

Then('user should see no duplicate namespaces', () => {
  cy.exec(`kubectl get namespaces bookinfo --context ${CLUSTER1_CONTEXT}`);
  cy.exec(`kubectl get namespaces bookinfo --context ${CLUSTER2_CONTEXT}`);

  cy.getBySel('namespace-dropdown-list')
    .should('exist')
    .contains('bookinfo')
    .should('be.visible')
    .and('have.length', 1);
});

// Health cache metrics test steps
Given('health cache is enabled', () => {
  enableKialiFeature(HEALTH_CACHE_CONFIG);
  waitForKialiApiReady();
});

Given('health cache metrics are recorded', () => {
  cy.request({ url: 'api/test/metrics/health/cache' }).then(resp => {
    expect(resp.status).to.eq(200);
    const before = resp.body as HealthCacheMetrics;
    cy.wrap(before, { log: false }).as('healthCacheMetricsBefore');
    cy.log(`health cache metrics (before): ${JSON.stringify(before)}`);
  });
});

When('user visits the apps list page for {string} namespace', (namespace: string) => {
  // The apps endpoint includes health data when health=true query param is set
  // The backend uses the health cache to populate this data
  cy.intercept(`**/api/clusters/apps*`).as('appsRequest');

  cy.visit({ url: `/console/applications?namespaces=${namespace}&refresh=0` });

  // Wait for the apps request (which includes health data from the cache)
  cy.wait('@appsRequest');
});

Then('health cache metrics should show at least {int} hit', (minHits: number) => {
  cy.get('@healthCacheMetricsBefore').then(beforeObj => {
    const before = (beforeObj as unknown) as HealthCacheMetrics;

    cy.request({ url: 'api/test/metrics/health/cache' }).then(resp => {
      expect(resp.status).to.eq(200);
      const after = resp.body as HealthCacheMetrics;

      cy.log(`health cache metrics (before): ${JSON.stringify(before)}`);
      cy.log(`health cache metrics (after): ${JSON.stringify(after)}`);

      expect(after.healthCacheHits).to.be.at.least(before.healthCacheHits + minHits);
    });
  });
});

// Health status metric test steps
interface HealthStatusMetricItem {
  cluster: string;
  namespace: string;
  healthType: string;
  name: string;
  value: number;
}

// Helper to convert health status numeric value to status string
const healthStatusValueToString = (value: number): string => {
  switch (value) {
    case 0:
      return 'Healthy';
    case 1:
      return 'Not Ready';
    case 2:
      return 'Degraded';
    case 3:
      return 'Failure';
    default:
      return 'Unknown';
  }
};

// Parse Prometheus text format and extract kiali_health_status metrics
const parseHealthStatusMetrics = (prometheusText: string): HealthStatusMetricItem[] => {
  const metrics: HealthStatusMetricItem[] = [];
  const lines = prometheusText.split('\n');

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith('#') || line.trim() === '') {
      continue;
    }

    // Match kiali_health_status metric lines
    // Example: kiali_health_status{cluster="Kubernetes",namespace="bookinfo",health_type="app",name="details"} 0
    const match = line.match(/^kiali_health_status\{([^}]+)\}\s+(.+)$/);
    if (match) {
      const labelsStr = match[1];
      const value = parseFloat(match[2]);

      // Parse labels
      const labels: { [key: string]: string } = {};
      const labelMatches = labelsStr.matchAll(/(\w+)="([^"]+)"/g);
      for (const labelMatch of labelMatches) {
        labels[labelMatch[1]] = labelMatch[2];
      }

      metrics.push({
        cluster: labels.cluster || '',
        namespace: labels.namespace || '',
        healthType: labels.health_type || '',
        name: labels.name || '',
        value: value
      });
    }
  }

  return metrics;
};

// Fetch health status metrics from the real Prometheus /metrics endpoint
const fetchHealthStatusMetrics = (): Cypress.Chainable<HealthStatusMetricItem[]> => {
  // The metrics endpoint is on port 9090 by default (configured in server.observability.metrics.port)
  // We need to use the same host but different port
  return cy.location('origin').then(origin => {
    const url = new URL(origin);
    const metricsUrl = `${url.protocol}//${url.hostname}:9090/metrics`;

    return cy
      .request({
        url: metricsUrl,
        failOnStatusCode: false
      })
      .then(resp => {
        if (resp.status !== 200) {
          cy.log(`Warning: Failed to fetch metrics from ${metricsUrl}, status: ${resp.status}`);
          return [];
        }
        const metrics = parseHealthStatusMetrics(resp.body);
        cy.log(`Parsed ${metrics.length} kiali_health_status metrics from ${metricsUrl}`);
        return metrics;
      });
  });
};

Given('health status metric is enabled', () => {
  // Health status metric requires health cache to be enabled
  enableKialiFeature(HEALTH_CACHE_CONFIG);
  enableKialiFeature(HEALTH_STATUS_METRIC_CONFIG);
  waitForKialiApiReady();
});

When('user waits for health status metrics to be available', () => {
  // Wait a bit for health cache to populate and metrics to be exported
  // Health cache refresh runs every few seconds
  cy.wait(15000);
});

Then('health status metric for {string} app {string} in {string} namespace should be {string}', function (
  appName: string,
  healthStatus: string,
  namespace: string
) {
  fetchHealthStatusMetrics().then(metrics => {
    cy.log(`Health status metrics: ${JSON.stringify(metrics, null, 2)}`);

    // Find the metric for this specific app
    const appMetric = metrics.find(m => m.healthType === 'app' && m.name === appName && m.namespace === namespace);

    expect(appMetric, `Metric for app ${appName} in namespace ${namespace} should exist`).to.not.be.undefined;

    if (appMetric) {
      const actualStatus = healthStatusValueToString(appMetric.value);
      cy.log(`App ${appName} health status metric value: ${appMetric.value} (${actualStatus})`);
      expect(actualStatus).to.eq(healthStatus);
    }
  });
});

Then('health status metrics should contain at least {int} metric', (minMetrics: number) => {
  fetchHealthStatusMetrics().then(metrics => {
    cy.log(`Health status metrics count: ${metrics.length}`);
    cy.log(`Health status metrics: ${JSON.stringify(metrics, null, 2)}`);

    expect(metrics.length).to.be.at.least(minMetrics);
  });
});

Then('health status metrics should not be empty', () => {
  fetchHealthStatusMetrics().then(metrics => {
    cy.log(`Health status metrics count: ${metrics.length}`);

    expect(metrics.length).to.be.greaterThan(0);
  });
});
