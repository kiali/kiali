import type { Page } from '@playwright/test';

export const OVERVIEW_API = {
  APP_RATES: '**/api/overview/metrics/apps/rates',
  CONTROL_PLANES: '**/api/mesh/controlplanes',
  CLUSTERS: '**/api/istio/status*',
  ISTIO_CONFIG: '**/api/istio/config',
  SERVICE_LATENCIES: '**/api/overview/metrics/services/latency',
  SERVICE_RATES: '**/api/overview/metrics/services/rates',
  SERVICE_THROUGHPUT: '**/api/overview/metrics/services/throughput'
} as const;

export const istioConfigsWithNoValidations = {
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

type ControlPlaneStatus = 'Healthy' | 'Unhealthy';

export const makeControlPlane = (opts: {
  clusterName: string;
  istiodName: string;
  status: ControlPlaneStatus;
}): Record<string, unknown> => ({
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
});

const delayMs = 2_000;

const routeWithDelay = async (page: Page, url: string, body: unknown, status = 200): Promise<void> => {
  await page.route(url, async route => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
    await route.fulfill({ status, json: body });
  });
};

export const mockIstioConfigsWarnings = async (page: Page): Promise<void> => {
  await page.route('**/api/istio/config**', async route => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 200, json: istioConfigsWithNoValidations });
  });
};

export const mockAllOverviewApisSlow = async (page: Page): Promise<void> => {
  await routeWithDelay(page, OVERVIEW_API.CONTROL_PLANES, []);
  await routeWithDelay(page, OVERVIEW_API.CLUSTERS, []);
};

export const mockAllOverviewApisFail = async (page: Page): Promise<void> => {
  await page.route(OVERVIEW_API.CONTROL_PLANES, route => route.fulfill({ status: 500, json: {} }));
  await page.route(OVERVIEW_API.CLUSTERS, route => route.fulfill({ status: 500, json: {} }));
};

export const mockControlPlanesFail = async (page: Page): Promise<void> => {
  await page.route(OVERVIEW_API.CONTROL_PLANES, route => route.fulfill({ status: 500, json: {} }));
};

export const mockControlPlanesUnhealthy = async (page: Page, clusterName: string): Promise<void> => {
  await page.route(OVERVIEW_API.CONTROL_PLANES, route =>
    route.fulfill({
      status: 200,
      json: [
        makeControlPlane({
          clusterName,
          istiodName: `istiod-${clusterName.toLowerCase()}`,
          status: 'Unhealthy'
        })
      ]
    })
  );
};

export const mockControlPlanesHealthy = async (page: Page, count = 1): Promise<void> => {
  const planes = Array.from({ length: count }, (_, i) =>
    makeControlPlane({
      clusterName: 'Kubernetes',
      istiodName: i === 0 ? 'istiod-kubernetes' : `istiod-kubernetes-${i}`,
      status: 'Healthy'
    })
  );
  await page.route(OVERVIEW_API.CONTROL_PLANES, route => route.fulfill({ status: 200, json: planes }));
};

export type ClustersRetryHandle = {
  allowSuccess: () => void;
};

export const mockClustersFailOnce = async (page: Page): Promise<ClustersRetryHandle> => {
  let allowSuccess = false;
  await page.route(OVERVIEW_API.CLUSTERS, route => {
    if (!allowSuccess) {
      route.fulfill({ status: 500, json: {} });
    } else {
      route.continue();
    }
  });
  return {
    allowSuccess: () => {
      allowSuccess = true;
    }
  };
};

export const mockClustersEmpty = async (page: Page): Promise<void> => {
  await page.route(OVERVIEW_API.CLUSTERS, route => route.fulfill({ status: 200, json: [] }));
};

export const mockServiceInsightsSlow = async (page: Page): Promise<void> => {
  await routeWithDelay(page, OVERVIEW_API.SERVICE_LATENCIES, {});
  await routeWithDelay(page, OVERVIEW_API.SERVICE_RATES, { services: [] });
  await routeWithDelay(page, OVERVIEW_API.SERVICE_THROUGHPUT, {});
};

export const mockServiceInsightsFail = async (page: Page): Promise<void> => {
  await page.route(OVERVIEW_API.SERVICE_LATENCIES, route => route.fulfill({ status: 500, json: {} }));
  await page.route(OVERVIEW_API.SERVICE_RATES, route => route.fulfill({ status: 500, json: {} }));
  await page.route(OVERVIEW_API.SERVICE_THROUGHPUT, route => route.fulfill({ status: 500, json: {} }));
};

const mockFailOnceRoute = async (page: Page, url: string): Promise<void> => {
  let failed = false;
  await page.route(url, route => {
    if (!failed) {
      failed = true;
      route.fulfill({ status: 500, json: {} });
    } else {
      route.continue();
    }
  });
};

export const mockServiceInsightsFailOnce = async (page: Page): Promise<void> => {
  await mockFailOnceRoute(page, OVERVIEW_API.SERVICE_LATENCIES);
  await mockFailOnceRoute(page, OVERVIEW_API.SERVICE_RATES);
  await mockFailOnceRoute(page, OVERVIEW_API.SERVICE_THROUGHPUT);
};

export const mockServiceInsightsRates = async (page: Page): Promise<void> => {
  await page.route(OVERVIEW_API.SERVICE_RATES, route =>
    route.fulfill({
      status: 200,
      json: {
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
    })
  );
};

export const mockApplicationsSlow = async (page: Page): Promise<void> => {
  await routeWithDelay(page, OVERVIEW_API.APP_RATES, { apps: [] });
};

export const mockApplicationsFail = async (page: Page): Promise<void> => {
  await page.route(OVERVIEW_API.APP_RATES, route => route.fulfill({ status: 500, json: {} }));
};

export const mockApplicationsFailOnce = async (page: Page): Promise<void> => {
  await mockFailOnceRoute(page, OVERVIEW_API.APP_RATES);
};

export const mockApplicationsRates = async (page: Page): Promise<void> => {
  await page.route(OVERVIEW_API.APP_RATES, route =>
    route.fulfill({
      status: 200,
      json: {
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
    })
  );
};
