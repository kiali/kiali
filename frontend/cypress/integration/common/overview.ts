import { After, Before, Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';

const APP_RATES_API_PATHNAME = '**/api/overview/metrics/apps/rates';
const CONTROL_PLANES_API_PATHNAME = '**/api/mesh/controlplanes';
const CLUSTERS_API_URL = '**/api/istio/status*';
const SERVICE_LATENCIES_API_PATHNAME = '**/api/overview/metrics/services/latency';
const SERVICE_RATES_API_PATHNAME = '**/api/overview/metrics/services/rates';

let didAppsCardRetry = false;
let didServiceInsightsRetry = false;
let lastClickedServiceInsightsHref: string | undefined;
let shouldWaitAppsCardRetry = false;
let shouldWaitServiceInsightsRetry = false;

Before(() => {
  didAppsCardRetry = false;
  didServiceInsightsRetry = false;
  lastClickedServiceInsightsHref = undefined;
  shouldWaitAppsCardRetry = false;
  shouldWaitServiceInsightsRetry = false;
});

const istioConfigsWithNoValidations = {
  permissions: {},
  resources: {
    'networking.istio.io/v1, Kind=Gateway': [
      { apiVersion: 'networking.istio.io/v1', kind: 'Gateway', metadata: { name: 'gw1', namespace: 'alpha' } },
      { apiVersion: 'networking.istio.io/v1', kind: 'Gateway', metadata: { name: 'gw2', namespace: 'alpha' } },
      { apiVersion: 'networking.istio.io/v1', kind: 'Gateway', metadata: { name: 'gw3', namespace: 'beta' } },
      { apiVersion: 'networking.istio.io/v1', kind: 'Gateway', metadata: { name: 'gw4', namespace: 'beta' } }
    ]
  },
  validations: {}
};

Given('Istio configs API returns at least 4 warning configs', () => {
  // The Overview Istio configs card calls /api/istio/config.
  // Returning configs without validations makes them show up as "Not Validated", which is counted as a warning.
  cy.intercept(
    {
      method: 'GET',
      pathname: '**/api/istio/config'
    },
    {
      statusCode: 200,
      body: istioConfigsWithNoValidations
    }
  ).as('allIstioConfigs');
});

const getControlPlanesCard = (): Cypress.Chainable => {
  return cy.getBySel('control-planes-card');
};

const getDataPlanesCard = (): Cypress.Chainable => {
  return cy.getBySel('data-planes-card');
};

const getServiceInsightsCard = (): Cypress.Chainable => {
  return cy.getBySel('service-insights-card');
};

const parseUrlPathAndSearch = (href: string): string => {
  try {
    const u = new URL(href, Cypress.config('baseUrl') as string);
    return `${u.pathname}${u.search}`;
  } catch {
    return href;
  }
};

const makeControlPlane = (opts: { clusterName: string; istiodName: string; status: 'Healthy' | 'Unhealthy' }): any => {
  return {
    cluster: {
      accessible: true,
      apiEndpoint: '',
      isKialiHome: true,
      kialiInstances: [],
      name: opts.clusterName,
      secretName: ''
    },
    config: {},
    istiodName: opts.istiodName,
    revision: 'default',
    status: opts.status,
    thresholds: {}
  };
};

// Combined API intercepts for testing all cards together
Given('all overview APIs respond slowly', () => {
  cy.intercept({ method: 'GET', pathname: CONTROL_PLANES_API_PATHNAME }, { delay: 2000, statusCode: 200, body: [] }).as(
    'controlPlanes'
  );

  // Use url pattern to catch all requests including those from IstioStatus component
  cy.intercept({ method: 'GET', url: CLUSTERS_API_URL }, { delay: 2000, statusCode: 200, body: [] }).as(
    'clustersStatus'
  );
});

Given('all overview APIs fail', () => {
  cy.intercept({ method: 'GET', pathname: CONTROL_PLANES_API_PATHNAME }, { statusCode: 500, body: {} }).as(
    'controlPlanes'
  );

  // Use url pattern to catch all requests including those from IstioStatus component
  cy.intercept({ method: 'GET', url: CLUSTERS_API_URL }, { statusCode: 500, body: {} }).as('clustersStatus');
});

// Individual API intercepts for card-specific tests
Given('Control planes API fails', () => {
  cy.intercept(
    {
      method: 'GET',
      pathname: CONTROL_PLANES_API_PATHNAME
    },
    {
      statusCode: 500,
      body: {}
    }
  ).as('controlPlanes');
});

Given('Control planes API returns 1 unhealthy control plane in cluster {string}', (clusterName: string) => {
  cy.intercept(
    {
      method: 'GET',
      pathname: CONTROL_PLANES_API_PATHNAME
    },
    {
      statusCode: 200,
      body: [
        makeControlPlane({
          clusterName,
          istiodName: `istiod-${clusterName.toLowerCase()}`,
          status: 'Unhealthy'
        })
      ]
    }
  ).as('controlPlanes');
});

Then('Control planes card shows loading state without count or footer link', () => {
  // Ensure we are still in loading state (don't wait for the response).
  getControlPlanesCard().within(() => {
    cy.contains('Fetching control plane data').should('be.visible');
    cy.contains('Control planes (').should('not.exist');
    cy.contains('View Control planes').should('not.exist');
  });
});

Then('Control planes card shows error state without count or footer link', () => {
  cy.wait('@controlPlanes');
  cy.waitForReact();
  getControlPlanesCard().within(() => {
    cy.contains('Control planes could not be loaded').should('be.visible');
    cy.contains('Try Again').should('be.visible');
    cy.contains('Control planes (').should('not.exist');
    cy.contains('View Control planes').should('not.exist');
  });
});

When('Control planes API succeeds with 1 healthy control plane', () => {
  cy.intercept(
    {
      method: 'GET',
      pathname: CONTROL_PLANES_API_PATHNAME
    },
    {
      statusCode: 200,
      body: [makeControlPlane({ clusterName: 'Kubernetes', istiodName: 'istiod-kubernetes', status: 'Healthy' })]
    }
  ).as('controlPlanesRetry');
});

When('user clicks Try Again in Control planes card', () => {
  getControlPlanesCard().within(() => {
    cy.contains('button', 'Try Again').should('be.visible').click();
  });
  cy.wait('@controlPlanesRetry');
});

Then('Control planes card shows count {int} and footer link', (count: number) => {
  getControlPlanesCard().within(() => {
    cy.contains(`Control planes (${count})`).should('be.visible');
    cy.contains('View Control planes').should('be.visible');
  });
});

When('user opens the Control planes issues popover', () => {
  cy.wait('@controlPlanes').its('response.statusCode').should('eq', 200);
  cy.getBySel('control-planes-issues').should('be.visible').click();
});

When('user clicks the {string} control plane link in the popover', (istiodName: string) => {
  cy.contains('a', istiodName).should('be.visible').click();
});

Then('user is redirected to Mesh page with cluster filter {string}', (clusterName: string) => {
  cy.location('pathname').should('match', /\/console\/mesh$/);
  cy.location('search').then(search => {
    const params = new URLSearchParams(search);
    expect(params.get('meshHide')).to.eq(`cluster!=${clusterName}`);
  });
});

When('user opens the Istio configs warnings popover', () => {
  cy.wait('@allIstioConfigs').its('response.statusCode').should('eq', 200);
  cy.getBySel('istio-configs-warnings').should('be.visible').click();
  cy.contains('View warning Istio configs').should('be.visible');
});

When('user clicks the {string} popover action', (label: string) => {
  cy.contains('button', label).should('be.visible').click();
});

Then('user is redirected to Istio config list with all namespaces and warning filters', () => {
  cy.location('pathname').should('match', /\/console\/istio$/);

  cy.location('search').then(search => {
    const params = new URLSearchParams(search);

    // Filters from the "View all" navigation
    expect(params.getAll('config')).to.include.members(['Warning', 'Not Validated']);
    expect(params.get('opLabel')).to.eq('or');

    // Selecting all namespaces is encoded as a comma-separated list
    const urlNamespaces = Array.from(
      new Set(
        (params.get('namespaces') ?? '')
          .split(',')
          .map(n => n.trim())
          .filter(Boolean)
      )
    ).sort();

    cy.request('api/namespaces').then(resp => {
      const allNamespaces = Array.from(new Set((resp.body as Array<{ name: string }>).map(ns => ns.name))).sort();
      expect(urlNamespaces).to.deep.eq(allNamespaces);
    });
  });
});

When('user clicks View Data planes in Data planes card', () => {
  getDataPlanesCard().within(() => {
    cy.getBySel('data-planes-view').should('be.visible').click();
  });
});

Then('user is redirected to Namespaces page with data-plane type filter', () => {
  cy.location('pathname').should('match', /\/console\/namespaces$/);
  cy.location('search').then(search => {
    const params = new URLSearchParams(search);
    expect(params.get('type')).to.eq('Data plane');
  });
});

// ==================== Clusters Stats Card ====================

const getClustersCard = (): Cypress.Chainable => {
  return cy.getBySel('clusters-card');
};

Given('Clusters API fails once', () => {
  // Intercept twice to cover both ClusterStats and IstioStatus components
  // Subsequent requests (like retry) will hit real backend
  cy.intercept(
    {
      method: 'GET',
      url: CLUSTERS_API_URL,
      times: 2
    },
    {
      statusCode: 500,
      body: {}
    }
  ).as('clustersStatus');
});

Given('Clusters API returns empty data', () => {
  // Use a function handler to ensure ALL requests to this endpoint return empty data
  cy.intercept({ method: 'GET', url: CLUSTERS_API_URL }, req => {
    req.reply({
      statusCode: 200,
      body: []
    });
  }).as('clustersStatus');
});

When('user clicks Try Again in Clusters card', () => {
  getClustersCard().within(() => {
    cy.contains('button', 'Try Again').should('be.visible').click();
  });
});

Then('Clusters card shows loading state without count or footer link', () => {
  getClustersCard().within(() => {
    cy.contains('Fetching cluster data').should('be.visible');
    cy.contains('Clusters (').should('not.exist');
    cy.contains('View Mesh').should('not.exist');
  });
});

Then('Clusters card shows error state without count or footer link', () => {
  cy.wait('@clustersStatus');
  cy.waitForReact();
  getClustersCard()
    .should('be.visible')
    .within(() => {
      cy.contains('Clusters could not be loaded').should('be.visible');
      cy.contains('Try Again').should('be.visible');
      cy.contains('Clusters (').should('not.exist');
      cy.contains('View Mesh').should('not.exist');
    });
});

Then('Clusters card shows count {int} and footer link', (count: number) => {
  getClustersCard().within(() => {
    cy.contains(`Clusters (${count})`).should('be.visible');
    cy.contains('View Mesh').should('be.visible');
  });
});

Then('Clusters card shows no data state with dash', () => {
  cy.wait('@clustersStatus');
  cy.waitForReact();
  getClustersCard().within(() => {
    cy.contains('Clusters (0)').should('be.visible');
    cy.contains('–').should('be.visible');
    cy.contains('View Mesh').should('be.visible');
  });
});

// Tests using real backend data - no API mocking
Then('Clusters card shows cluster count and footer link', () => {
  cy.waitForReact();
  getClustersCard().within(() => {
    cy.contains('Could not be loaded').should('not.exist');

    // The card should show clusters data (title contains "Clusters")
    cy.getBySel('clusters-card-title').should('contain', 'Clusters');

    // Footer link should be visible when data loaded successfully
    cy.contains('a', 'View Mesh').should('be.visible');
  });
});

When('user clicks View Mesh link in Clusters card', () => {
  getClustersCard().within(() => {
    cy.contains('a', 'View Mesh').click();
  });
});

Then('user is redirected to Mesh page', () => {
  cy.url().should('include', '/mesh');
});

// Multi-cluster tests using real backend data
function waitForUnhealthyClusters(retries: number): void {
  if (retries <= 0) {
    throw new Error('Exceeded max retries waiting for unhealthy clusters to appear');
  }

  cy.waitForReact();
  cy.get('body').then($body => {
    const $issues = $body.find('[data-test="clusters-issues"]');
    if ($issues.length > 0 && $issues.is(':visible')) {
      cy.log('Found unhealthy clusters');
      cy.getBySel('clusters-issues').should('be.visible');
    } else {
      cy.log(`Unhealthy clusters not found yet, retries left: ${retries - 1}. Waiting 10s before retry...`);
      cy.wait(10000);
      cy.get('[data-test="refresh-button"]').click();
      waitForUnhealthyClusters(retries - 1);
    }
  });
}

Then('Clusters card shows unhealthy clusters count', () => {
  // Cluster status may take time to propagate after scaling down istiod
  waitForUnhealthyClusters(6);
});

When('user opens the Clusters issues popover', () => {
  getClustersCard().within(() => {
    cy.getBySel('clusters-issues').should('be.visible').click();
  });
});

Then('Clusters popover shows cluster with issues', () => {
  cy.get('[role="dialog"]').within(() => {
    cy.contains('issue').should('be.visible');
  });
});

function waitForHealthyClusters(retries: number): void {
  if (retries <= 0) {
    throw new Error('Exceeded max retries waiting for healthy clusters');
  }

  cy.waitForReact();
  cy.get('body').then($body => {
    const $healthy = $body.find('[data-test="clusters-healthy"]');
    const $issues = $body.find('[data-test="clusters-issues"]');
    if ($healthy.length > 0 && $healthy.is(':visible') && $issues.length === 0) {
      cy.log('All clusters are healthy');
      cy.getBySel('clusters-healthy').should('be.visible');
      cy.getBySel('clusters-issues').should('not.exist');
    } else {
      cy.log(`Clusters not fully healthy yet, retries left: ${retries - 1}. Waiting 10s before retry...`);
      cy.wait(10000);
      cy.get('[data-test="refresh-button"]').click();
      waitForHealthyClusters(retries - 1);
    }
  });
}

Then('Clusters card shows all healthy clusters', () => {
  // Cluster status may take time to propagate after scaling up istiod
  waitForHealthyClusters(6);
});

// Cleanup hook to restore istiod after unhealthy cluster test
After({ tags: '@clusters-health-restore' }, () => {
  cy.exec('kubectl scale -n istio-system --replicas=1 deployment/istiod', { failOnNonZeroExit: false });
  cy.exec('kubectl rollout status deployment istiod -n istio-system', { timeout: 120000, failOnNonZeroExit: false });
});

Given('Service insights APIs are observed', () => {
  didServiceInsightsRetry = false;
  cy.intercept({ method: 'GET', pathname: SERVICE_LATENCIES_API_PATHNAME }).as('serviceLatencies');
  cy.intercept({ method: 'GET', pathname: SERVICE_RATES_API_PATHNAME }).as('serviceRates');
});

// this is specifically to mock the serviceRates API because when cache is disabled (by default for cypress)
// the actual call will not return any services.
Given('Service insights mock APIs are observed', () => {
  didServiceInsightsRetry = false;
  // no need at this time to mock the latencies
  cy.intercept({ method: 'GET', pathname: SERVICE_LATENCIES_API_PATHNAME }).as('serviceLatenciesMock');
  cy.intercept(
    { method: 'GET', pathname: SERVICE_RATES_API_PATHNAME },
    {
      statusCode: 200,
      body: {
        services: [
          {
            cluster: 'Kubernetes',
            errorRate: 0.5495495495495495,
            healthStatus: 'Failure',
            namespace: 'bookinfo',
            requestRate: 1.5578947368421052,
            serviceName: 'reviews'
          },
          {
            cluster: 'Kubernetes',
            errorRate: 0.45759717314487636,
            healthStatus: 'Failure',
            namespace: 'beta',
            requestRate: 1.9859649122807015,
            serviceName: 'w-server'
          }
        ]
      }
    }
  ).as('serviceRatesMock');
});

Given('Service insights APIs respond slowly', () => {
  didServiceInsightsRetry = false;
  cy.intercept({ method: 'GET', pathname: SERVICE_LATENCIES_API_PATHNAME }, req => {
    req.continue(res => {
      res.delay = 2000;
    });
  }).as('serviceLatencies');

  cy.intercept({ method: 'GET', pathname: SERVICE_RATES_API_PATHNAME }, req => {
    req.continue(res => {
      res.delay = 2000;
    });
  }).as('serviceRates');
});

Given('Service insights APIs fail', () => {
  didServiceInsightsRetry = false;
  cy.intercept({ method: 'GET', pathname: SERVICE_LATENCIES_API_PATHNAME }, { statusCode: 500, body: {} }).as(
    'serviceLatencies'
  );
  cy.intercept({ method: 'GET', pathname: SERVICE_RATES_API_PATHNAME }, { statusCode: 500, body: {} }).as(
    'serviceRates'
  );
});

Given('Service insights APIs fail once', () => {
  didServiceInsightsRetry = false;
  shouldWaitServiceInsightsRetry = true;

  // Observe subsequent (retry) calls without modifying them.
  cy.intercept({ method: 'GET', pathname: SERVICE_LATENCIES_API_PATHNAME }).as('serviceLatencies');
  cy.intercept({ method: 'GET', pathname: SERVICE_RATES_API_PATHNAME }).as('serviceRates');

  cy.intercept({ method: 'GET', pathname: SERVICE_LATENCIES_API_PATHNAME, times: 1 }, { statusCode: 500, body: {} }).as(
    'serviceLatenciesFailOnce'
  );

  cy.intercept({ method: 'GET', pathname: SERVICE_RATES_API_PATHNAME, times: 1 }, { statusCode: 500, body: {} }).as(
    'serviceRatesFailOnce'
  );
});

Then('Service insights card shows loading state without tables or footer link', () => {
  getServiceInsightsCard().within(() => {
    cy.contains('Fetching service data').should('be.visible');
    cy.getBySel('service-insights-view-all-services').should('not.exist');
  });
});

Then('Service insights card shows error state without tables or footer link', () => {
  if (shouldWaitServiceInsightsRetry) {
    cy.wait('@serviceLatenciesFailOnce');
    cy.wait('@serviceRatesFailOnce');
  } else {
    cy.wait('@serviceLatencies');
    cy.wait('@serviceRates');
  }

  getServiceInsightsCard().within(() => {
    cy.contains('Failed to load service data').should('be.visible');
    cy.contains('button', 'Try Again').should('be.visible');
    cy.getBySel('service-insights-view-all-services').should('not.exist');
  });
});

When('user clicks Try Again in Service insights card', () => {
  getServiceInsightsCard().within(() => {
    cy.contains('button', 'Try Again').should('be.visible').click();
  });

  if (shouldWaitServiceInsightsRetry) {
    cy.wait('@serviceLatencies');
    cy.wait('@serviceRates');
    didServiceInsightsRetry = true;
    shouldWaitServiceInsightsRetry = false;
  }
});

Then('Service insights card shows data tables and footer link', () => {
  // If we didn't already wait for a retry, wait for the initial real API responses so assertions are stable.
  if (!didServiceInsightsRetry) {
    cy.wait('@serviceLatencies');
    cy.wait('@serviceRates');
  }

  getServiceInsightsCard().within(() => {
    cy.contains('Fetching service data').should('not.exist');
    cy.contains('Failed to load service data').should('not.exist');
    cy.getBySel('service-insights-view-all-services').should('be.visible');
  });

  // Rates section: should be empty because it depends on health cache, which is disabled during
  // standard cypress testing.
  cy.getBySel('service-insights-rates').within(() => {
    cy.contains('not available').should('be.visible');
  });

  // Latencies section: table should have data because this queries prometheus directly
  cy.getBySel('service-insights-latencies').within(() => {
    cy.get('table').then(_ => {
      cy.contains('th', 'Name').should('be.visible');
      cy.contains('th', 'Latency').should('be.visible');

      cy.get('tbody tr').then($rows => {
        if ($rows.length === 0) {
          return;
        }
        cy.wrap($rows[0]).within(() => {
          cy.get('a')
            .should('have.attr', 'href')
            .and('match', /\/namespaces\/.+\/services\/.+/);
          cy.contains(/ms|s/).should('be.visible');
        });
      });
    });
  });
});

Then('Service insights card shows mock data tables', () => {
  cy.wait('@serviceLatenciesMock');
  cy.wait('@serviceRatesMock');

  getServiceInsightsCard().within(() => {
    cy.contains('Fetching service data').should('not.exist');
    cy.contains('Failed to load service data').should('not.exist');
    cy.getBySel('service-insights-view-all-services').should('be.visible');
  });

  // Rates section: should be mock
  cy.getBySel('service-insights-rates').within(() => {
    cy.get('table').then(_ => {
      cy.contains('th', 'Name').should('be.visible');
      cy.contains('th', 'Errors').should('be.visible');

      cy.get('tbody tr').then($rows => {
        expect($rows).to.have.length(2);
        cy.wrap($rows[0]).within(() => {
          cy.get('a')
            .should('have.attr', 'href')
            .and('match', /\/namespaces\/.+\/services\/.+/);
          cy.contains('%').should('be.visible');
        });
      });
    });
  });

  // Latencies section: table should have data because this queries prometheus directly
  // not mocked at the moment, is tested elsewhere
});

When('user clicks View all services in Service insights card', () => {
  cy.wait('@serviceLatencies');
  cy.wait('@serviceRates');

  getServiceInsightsCard().within(() => {
    cy.getBySel('service-insights-view-all-services').should('be.visible').click();
  });
});

Then('user is redirected to Services list with all namespaces and service insights sorting', () => {
  cy.location('pathname').should('match', /\/(console|ossmconsole)\/services$/);
  cy.location('search').then(search => {
    const params = new URLSearchParams(search);

    // Filters from the "View all" navigation
    expect(params.get('direction')).to.eq('asc');
    expect(params.get('sort')).to.eq('he');

    const urlNamespaces = Array.from(
      new Set(
        (params.get('namespaces') ?? '')
          .split(',')
          .map(n => n.trim())
          .filter(Boolean)
      )
    ).sort();

    expect(urlNamespaces.length, 'namespaces query param should be present').to.be.greaterThan(0);

    cy.request('api/namespaces').then(resp => {
      const allNamespaces = Array.from(new Set((resp.body as Array<{ name: string }>).map(ns => ns.name))).sort();
      expect(urlNamespaces).to.deep.eq(allNamespaces);
    });
  });
});

When('user clicks a valid service link in Service insights card', () => {
  cy.wait('@serviceLatencies');
  cy.wait('@serviceRates');

  lastClickedServiceInsightsHref = undefined;

  // Wait until the card is done rendering after the API responses:
  // it must have either at least one service link, or show the empty state.
  getServiceInsightsCard()
    .should($card => {
      const hasServiceLink =
        $card.find('[data-test="service-insights-rates"] a').length > 0 ||
        $card.find('[data-test="service-insights-latencies"] a').length > 0;

      const hasEmptyState = $card.text().includes('not available');

      expect(
        hasServiceLink || hasEmptyState,
        'Service Insights should eventually show at least one service link or the empty state'
      ).to.eq(true);
    })
    .then($card => {
      const hasRateLink = $card.find('[data-test="service-insights-rates"] a').length > 0;
      const hasLatencyLink = $card.find('[data-test="service-insights-latencies"] a').length > 0;
      const hasServiceLink = hasRateLink || hasLatencyLink;

      if (!hasServiceLink) {
        // Nothing to click in real data; assert the empty state and exit.
        getServiceInsightsCard().within(() => {
          cy.contains('not available').should('be.visible');
        });
        return;
      }

      const containerSel = hasRateLink
        ? '[data-test="service-insights-rates"]'
        : '[data-test="service-insights-latencies"]';

      const isServiceDetailsPageValid = ($body: JQuery<HTMLBodyElement>): boolean => {
        // When the service is not found, ServiceDetailsPage sets error and does NOT render tabs.
        return $body.find('#basic-tabs').length > 0;
      };

      const escapeCssAttrValue = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

      const tryHrefAtIndex = (hrefs: string[], idx: number): Cypress.Chainable => {
        if (idx >= hrefs.length) {
          throw new Error('No valid Service Insights service link found (all navigations ended in an error page).');
        }

        const href = hrefs[idx];
        lastClickedServiceInsightsHref = parseUrlPathAndSearch(href);

        // Click inside the Service Insights card to avoid matching other links.
        return getServiceInsightsCard()
          .within(() => {
            cy.get(`a[href="${escapeCssAttrValue(href)}"]`)
              .first()
              .should('be.visible')
              .click();
          })
          .then(() => cy.get('#loading_kiali_spinner', { timeout: 40000 }).should('not.exist'))
          .then(() => cy.get('body', { timeout: 40000 }))
          .then($body => {
            if (isServiceDetailsPageValid($body as JQuery<HTMLBodyElement>)) {
              return;
            }

            // Invalid service details; go back and try the next link.
            return cy
              .go('back')
              .then(() => cy.get('#loading_kiali_spinner', { timeout: 40000 }).should('not.exist'))
              .then(() => cy.location('pathname').should('match', /\/(console|ossmconsole)\/overview$/))
              .then(() => getServiceInsightsCard().should('be.visible'))
              .then(() => tryHrefAtIndex(hrefs, idx + 1));
          });
      };

      cy.get(`${containerSel} table tbody tr a`)
        .should('exist')
        .then($links => {
          const hrefs = Array.from($links)
            .map(a => (a as HTMLAnchorElement).getAttribute('href') ?? '')
            .map(h => h.trim())
            .filter(Boolean);

          const uniqueHrefs = Array.from(new Set(hrefs));
          return tryHrefAtIndex(uniqueHrefs, 0);
        });
    });
});

Then('user is redirected to that Service details page', () => {
  if (!lastClickedServiceInsightsHref) {
    // not available case: the previous step already asserted "not available".
    return;
  }

  const normalizePath = (pathname: string): string => {
    return pathname.replace(/^\/(console|ossmconsole)/, '');
  };

  const toUrl = (pathAndSearch: string): URL => {
    return new URL(pathAndSearch, Cypress.config('baseUrl') as string);
  };

  cy.location('pathname').then(pathname => {
    cy.location('search').then(search => {
      const actualUrl = toUrl(`${pathname}${search}`);
      const expectedUrl = toUrl(lastClickedServiceInsightsHref);

      // Path must match exactly (ignoring /console vs /ossmconsole prefix).
      expect(normalizePath(actualUrl.pathname)).to.eq(normalizePath(expectedUrl.pathname));

      // Expected query params must be present (allowing extra params like duration/refresh).
      expectedUrl.searchParams.forEach((value, key) => {
        expect(actualUrl.searchParams.get(key), `query param ${key}`).to.eq(value);
      });
    });
  });

  // Basic smoke validation that the page exists/loaded.
  cy.get('#basic-tabs').should('exist');
  cy.contains('button, a', 'Overview').should('be.visible');
  cy.contains('button, a', 'Traffic').should('be.visible');
  cy.contains('button, a', 'Inbound Metrics').should('be.visible');
});

// ==================== Applications Card ====================

const getAppsCard = (): Cypress.Chainable => {
  return cy.getBySel('apps-card');
};

Given('Applications API responds slowly', () => {
  didAppsCardRetry = false;
  cy.intercept(
    { method: 'GET', pathname: APP_RATES_API_PATHNAME },
    { delay: 2000, statusCode: 200, body: { apps: [] } }
  ).as('appRates');
});

Given('Applications API fails', () => {
  didAppsCardRetry = false;
  cy.intercept({ method: 'GET', pathname: APP_RATES_API_PATHNAME }, { statusCode: 500, body: {} }).as('appRates');
});

Given('Applications API fails once', () => {
  didAppsCardRetry = false;
  shouldWaitAppsCardRetry = true;

  // Observe subsequent (retry) calls without modifying them.
  cy.intercept({ method: 'GET', pathname: APP_RATES_API_PATHNAME }).as('appRates');

  cy.intercept({ method: 'GET', pathname: APP_RATES_API_PATHNAME, times: 1 }, { statusCode: 500, body: {} }).as(
    'appRatesFailOnce'
  );
});

Given('Applications mock API returns data', () => {
  didAppsCardRetry = false;
  cy.intercept(
    { method: 'GET', pathname: APP_RATES_API_PATHNAME },
    {
      statusCode: 200,
      body: {
        apps: [
          {
            appName: 'productpage',
            cluster: 'Kubernetes',
            healthStatus: 'Healthy',
            namespace: 'bookinfo',
            requestRateIn: 3.5,
            requestRateOut: 2.1
          },
          {
            appName: 'reviews',
            cluster: 'Kubernetes',
            healthStatus: 'Degraded',
            namespace: 'bookinfo',
            requestRateIn: 1.2,
            requestRateOut: 0.8
          },
          {
            appName: 'idle-app',
            cluster: 'Kubernetes',
            healthStatus: 'Healthy',
            namespace: 'bookinfo',
            requestRateIn: 0,
            requestRateOut: 0
          }
        ]
      }
    }
  ).as('appRatesMock');
});

Given('Applications API is observed', () => {
  didAppsCardRetry = false;
  cy.intercept({ method: 'GET', pathname: APP_RATES_API_PATHNAME }).as('appRates');
});

Then('Applications card shows loading state without footer link', () => {
  getAppsCard().within(() => {
    cy.contains('Fetching applications data').should('be.visible');
    cy.getBySel('apps-card-view-all').should('not.exist');
  });
});

Then('Applications card shows error state without footer link', () => {
  if (shouldWaitAppsCardRetry) {
    cy.wait('@appRatesFailOnce');
  } else {
    cy.wait('@appRates');
  }

  getAppsCard().within(() => {
    cy.contains('Failed to load applications data').should('be.visible');
    cy.contains('button', 'Try Again').should('be.visible');
    cy.getBySel('apps-card-view-all').should('not.exist');
  });
});

When('user clicks Try Again in Applications card', () => {
  getAppsCard().within(() => {
    cy.contains('button', 'Try Again').should('be.visible').click();
  });

  if (shouldWaitAppsCardRetry) {
    cy.wait('@appRates');
    didAppsCardRetry = true;
    shouldWaitAppsCardRetry = false;
  }
});

Then('Applications card shows data and footer link', () => {
  if (!didAppsCardRetry) {
    cy.wait('@appRates');
  }

  getAppsCard().within(() => {
    cy.contains('Fetching applications data').should('not.exist');
    cy.contains('Failed to load applications data').should('not.exist');
    cy.getBySel('apps-card-view-all').should('be.visible');
  });
});

When('user clicks View all applications in Applications card', () => {
  cy.wait('@appRates');

  getAppsCard().within(() => {
    cy.getBySel('apps-card-view-all').should('be.visible').click();
  });
});

Then('user is redirected to Applications list with all namespaces', () => {
  cy.location('pathname').should('match', /\/(console|ossmconsole)\/applications$/);
  cy.location('search').then(search => {
    const params = new URLSearchParams(search);

    const urlNamespaces = Array.from(
      new Set(
        (params.get('namespaces') ?? '')
          .split(',')
          .map(n => n.trim())
          .filter(Boolean)
      )
    ).sort();

    expect(urlNamespaces.length, 'namespaces query param should be present').to.be.greaterThan(0);

    cy.request('api/namespaces').then(resp => {
      const allNamespaces = Array.from(new Set((resp.body as Array<{ name: string }>).map(ns => ns.name))).sort();
      expect(urlNamespaces).to.deep.eq(allNamespaces);
    });
  });
});

Then('Applications card shows mock rate data', () => {
  cy.wait('@appRatesMock');

  getAppsCard().within(() => {
    cy.contains('Fetching applications data').should('not.exist');
    cy.contains('Failed to load applications data').should('not.exist');
    cy.getBySel('apps-card-view-all').should('be.visible');
  });

  // Rates section: verify inbound and outbound are displayed
  cy.getBySel('apps-card-rates').within(() => {
    cy.contains('Inbound').should('be.visible');
    cy.contains('RPS').should('be.visible');
    cy.contains('Outbound').should('be.visible');
    cy.contains('apps with no traffic').should('be.visible');
  });

  // Health chart section: verify the donut chart is rendered
  cy.getBySel('apps-card-health').within(() => {
    cy.contains('Total applications').should('be.visible');
  });
});
