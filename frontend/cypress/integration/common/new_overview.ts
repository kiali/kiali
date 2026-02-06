import { After, Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';

const CONTROL_PLANES_API_PATHNAME = '**/api/mesh/controlplanes';
const CLUSTERS_API_URL = '**/api/istio/status*';
const SERVICE_LATENCIES_API_PATHNAME = '**/api/overview/metrics/services/latency';
const SERVICE_RATES_API_PATHNAME = '**/api/overview/metrics/services/rates';

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
return cy.contains('Data planes').closest('div[data-ouia-component-type="PF6/Card"]');

const getServiceInsightsCard = (): Cypress.Chainable => {
  return cy.getBySel('service-insights-card');
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

    Given('Control planes API responds slowly', () => {
      cy.intercept(
        {
          method: 'GET',
          pathname: CONTROL_PLANES_API_PATHNAME
        },
        {
          delay: 2000,
          statusCode: 200,
          body: []
        }
      ).as('controlPlanes');
    });

    Then('Control planes card shows error state without count or footer link', () => {
      cy.wait('@controlPlanes');
      cy.waitForReact();
      getControlPlanesCard().within(() => {
        cy.contains('Control planes could not be loaded').should('be.visible');
        cy.contains('Try Again').should('be.visible');
        cy.contains('Control planes (').should('not.exist');
        cy.contains('View Control planes').should('not.exist');
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
          cy.getBySel('data-planes-view-namespaces').should('be.visible').click();
        });
      });

      Then('user is redirected to Namespaces page with data-plane type filter', () => {
        cy.location('pathname').should('match', /\/console\/namespaces$/);
        cy.location('search').then(search => {
          const params = new URLSearchParams(search);
          expect(params.get('type')).to.eq('Data plane');
        });
      });

      Given('Service insights APIs respond slowly', () => {
        cy.intercept(
          { method: 'GET', pathname: SERVICE_LATENCIES_API_PATHNAME },
          { delay: 2000, statusCode: 200, body: { services: [] } }
        ).as('serviceLatencies');

        cy.intercept(
          { method: 'GET', pathname: SERVICE_RATES_API_PATHNAME },
          { delay: 2000, statusCode: 200, body: { services: [] } }
        ).as('serviceRates');
      });

      Given('Service insights APIs fail', () => {
        cy.intercept({ method: 'GET', pathname: SERVICE_LATENCIES_API_PATHNAME }, { statusCode: 500, body: {} }).as(
          'serviceLatencies'
        );
        cy.intercept({ method: 'GET', pathname: SERVICE_RATES_API_PATHNAME }, { statusCode: 500, body: {} }).as(
          'serviceRates'
        );
      });

      Given('Service insights APIs succeed with no data', () => {
        cy.intercept(
          { method: 'GET', pathname: SERVICE_LATENCIES_API_PATHNAME },
          { statusCode: 200, body: { services: [] } }
        ).as('serviceLatencies');
        cy.intercept({ method: 'GET', pathname: SERVICE_RATES_API_PATHNAME }, { statusCode: 200, body: { services: [] } }).as(
          'serviceRates'
        );
      });

      Given('Service insights APIs succeed with data', () => {
        cy.intercept(
          { method: 'GET', pathname: SERVICE_LATENCIES_API_PATHNAME },
          {
            statusCode: 200,
            body: {
              services: [
                { cluster: 'Kubernetes', latency: 250.5, namespace: 'alpha', serviceName: 'svc-a' },
                { cluster: 'Kubernetes', latency: 200.25, namespace: 'alpha', serviceName: 'svc-b' }
              ]
            }
          }
        ).as('serviceLatenciesRetry');

        cy.intercept(
          { method: 'GET', pathname: SERVICE_RATES_API_PATHNAME },
          {
            statusCode: 200,
            body: {
              services: [
                { cluster: 'Kubernetes', errorRate: 0.152, namespace: 'alpha', requestCount: 12.3, serviceName: 'svc-a' },
                { cluster: 'Kubernetes', errorRate: 0, namespace: 'alpha', requestCount: 9.1, serviceName: 'svc-b' }
              ]
            }
          }
        ).as('serviceRatesRetry');
      });

      Then('Service insights card shows loading state without tables or footer link', () => {
        getServiceInsightsCard().within(() => {
          cy.contains('Fetching service data').should('be.visible');
          cy.getBySel('service-insights-rates-table').should('not.exist');
          cy.getBySel('service-insights-latencies-table').should('not.exist');
          cy.getBySel('service-insights-view-all-services').should('not.exist');
        });
      });

      Then('Service insights card shows error state without tables or footer link', () => {
        cy.wait('@serviceLatencies');
        cy.wait('@serviceRates');

        getServiceInsightsCard().within(() => {
          cy.contains('Failed to load service data').should('be.visible');
          cy.contains('button', 'Try Again').should('be.visible');
          cy.getBySel('service-insights-rates-table').should('not.exist');
          cy.getBySel('service-insights-latencies-table').should('not.exist');
          cy.getBySel('service-insights-view-all-services').should('not.exist');
        });
      });

      When('user clicks Try Again in Service insights card', () => {
        getServiceInsightsCard().within(() => {
          cy.contains('button', 'Try Again').should('be.visible').click();
        });

        cy.wait('@serviceLatenciesRetry');
        cy.wait('@serviceRatesRetry');
      });

      Then('Service insights card shows data tables and footer link', () => {
        getServiceInsightsCard().within(() => {
          cy.getBySel('service-insights-rates-table').should('be.visible');
          cy.getBySel('service-insights-latencies-table').should('be.visible');
          cy.getBySel('service-insights-view-all-services').should('be.visible');
        });

        cy.getBySel('service-insights-rates-table').within(() => {
          cy.contains('th', 'Name').should('be.visible');
          cy.contains('th', 'Error rate').should('be.visible');

          cy.contains('a', 'svc-a').should('be.visible');
          cy.contains('15.2%').should('be.visible');

          cy.contains('a', 'svc-b').should('be.visible');
          cy.contains('0.0%').should('be.visible');
        });

        cy.getBySel('service-insights-latencies-table').within(() => {
          cy.contains('th', 'Name').should('be.visible');
          cy.contains('th', 'P95 latency').should('be.visible');

          cy.contains('a', 'svc-a').should('be.visible');
          cy.contains('250.50ms').should('be.visible');

          cy.contains('a', 'svc-b').should('be.visible');
          cy.contains('200.25ms').should('be.visible');
        });
      });

      When('user clicks View all services in Service insights card', () => {
        getServiceInsightsCard().within(() => {
          cy.getBySel('service-insights-view-all-services').should('be.visible').click();
        });
      });

      Then('user is redirected to Services list with all namespaces and service insights sorting', () => {
        cy.location('pathname').should('match', /\/(console|ossmconsole)\/services$/);

        cy.location('search').then(search => {
          const params = new URLSearchParams(search);

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

      When('user clicks the {string} service link in Service insights card', (serviceName: string) => {
        getServiceInsightsCard().within(() => {
          cy.getBySel('service-insights-rates-table').should('be.visible');
          cy.contains('a', serviceName).should('be.visible').click();
        });
      });

      Then(
        'user is redirected to Service details for namespace {string} service {string} in cluster {string}',
        (namespace: string, serviceName: string, clusterName: string) => {
          cy.location('pathname').should(
            'match',
            new RegExp(`\\/(console|ossmconsole)\\/namespaces\\/${namespace}\\/services\\/${serviceName}$`)
          );

          cy.location('search').then(search => {
            const params = new URLSearchParams(search);
            expect(params.get('clusterName')).to.eq(clusterName);
          });
        }
      );
