import { delay, http, HttpResponse } from 'msw';
import { InstanceType } from '../../types/Common';
import { Metric } from '../../types/Metrics';
import {
  getItemHealthStatus,
  getResponseDelay,
  getScenarioConfig,
  shouldApiReturnEmpty,
  shouldApiTimeout
} from '../scenarios';

// Helper to generate time series datapoints
const generateDatapoints = (baseValue: number, variance: number, points = 61): Array<[number, number]> => {
  const now = Date.now() / 1000;
  const datapoints: Array<[number, number]> = [];
  for (let i = points - 1; i >= 0; i--) {
    const timestamp = now - i * 60;
    const value = Math.max(0, baseValue + (Math.random() - 0.5) * variance);
    datapoints.push([timestamp, parseFloat(value.toFixed(3))]);
  }
  return datapoints;
};

// Generate mock IstioMetricsMap
const generateMockMetrics = (direction: string): Record<string, unknown> => {
  const reporter = direction === 'inbound' ? 'destination' : 'source';

  const requestCount: Metric = {
    datapoints: generateDatapoints(10, 5),
    labels: {
      reporter,
      request_protocol: 'http',
      response_code: '200'
    },
    name: 'request_count'
  };

  const requestErrorCount: Metric = {
    datapoints: generateDatapoints(0.1, 0.05),
    labels: {
      reporter,
      request_protocol: 'http',
      response_code: '500'
    },
    name: 'request_error_count'
  };

  const requestDuration: Metric = {
    datapoints: generateDatapoints(50, 20),
    labels: {
      reporter,
      request_protocol: 'http'
    },
    name: 'request_duration_millis',
    stat: 'avg'
  };

  const requestDurationP50: Metric = {
    datapoints: generateDatapoints(30, 10),
    labels: {
      reporter,
      request_protocol: 'http'
    },
    name: 'request_duration_millis',
    stat: '0.5'
  };

  const requestDurationP95: Metric = {
    datapoints: generateDatapoints(80, 30),
    labels: {
      reporter,
      request_protocol: 'http'
    },
    name: 'request_duration_millis',
    stat: '0.95'
  };

  const requestDurationP99: Metric = {
    datapoints: generateDatapoints(150, 50),
    labels: {
      reporter,
      request_protocol: 'http'
    },
    name: 'request_duration_millis',
    stat: '0.99'
  };

  const requestSize: Metric = {
    datapoints: generateDatapoints(1024, 512),
    labels: {
      reporter,
      request_protocol: 'http'
    },
    name: 'request_size'
  };

  const responseSize: Metric = {
    datapoints: generateDatapoints(2048, 1024),
    labels: {
      reporter,
      request_protocol: 'http'
    },
    name: 'response_size'
  };

  const tcpReceived: Metric = {
    datapoints: generateDatapoints(5000, 2000),
    labels: {
      reporter
    },
    name: 'tcp_received'
  };

  const tcpSent: Metric = {
    datapoints: generateDatapoints(8000, 3000),
    labels: {
      reporter
    },
    name: 'tcp_sent'
  };

  return {
    request_count: [requestCount],
    request_error_count: [requestErrorCount],
    request_duration_millis: [requestDuration, requestDurationP50, requestDurationP95, requestDurationP99],
    request_size: [requestSize],
    response_size: [responseSize],
    tcp_received: [tcpReceived],
    tcp_sent: [tcpSent]
  };
};

// Generate mock DashboardModel
const workloadNames = [
  'productpage-v1',
  'reviews-v2',
  'ratings-v1',
  'details-v1',
  'reviews-v3',
  'gateway-istio',
  'sleep',
  'httpbin'
];

const generateRandomSeries = (
  metricName: string,
  baseValue: number,
  variance: number,
  reporter: string,
  extraLabels?: Record<string, string>,
  stat?: string
): Array<Record<string, unknown>> => {
  const hash = metricName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const count = 1 + (hash % workloadNames.length);

  return workloadNames.slice(0, count).map((wl, i) => ({
    datapoints: generateDatapoints(baseValue * (1 + i * 0.15), variance),
    labels: { reporter, source_workload: wl, ...extraLabels },
    name: metricName,
    ...(stat ? { stat } : {})
  }));
};

const generateMockDashboard = (entityType: string, direction: string): Record<string, unknown> => {
  const reporter = direction === 'inbound' ? 'destination' : 'source';
  const directionLabel = direction === 'inbound' ? 'Inbound' : 'Outbound';

  return {
    title: `${entityType} ${directionLabel} Metrics`,
    charts: [
      {
        name: 'Request volume',
        unit: 'ops',
        spans: 3,
        metrics: generateRandomSeries('request_count', 10, 5, reporter, {
          request_protocol: 'http',
          response_code: '200'
        }),
        chartType: 'area',
        xAxis: 'time'
      },
      {
        name: 'Request duration',
        unit: 'ms',
        spans: 3,
        metrics: generateRandomSeries('request_duration_millis', 30, 10, reporter, {}, 'avg'),
        chartType: 'line',
        xAxis: 'time'
      },
      {
        name: 'Request size',
        unit: 'B',
        spans: 3,
        metrics: generateRandomSeries('request_size', 360, 20, reporter, {}, 'avg'),
        chartType: 'area',
        xAxis: 'time'
      },
      {
        name: 'Response size',
        unit: 'B',
        spans: 3,
        metrics: generateRandomSeries('response_size', 190, 10, reporter, {}, 'avg'),
        chartType: 'area',
        xAxis: 'time'
      },
      {
        name: 'Request throughput',
        unit: 'kbit/s',
        spans: 3,
        metrics: generateRandomSeries('request_throughput', 900, 300, reporter),
        chartType: 'area',
        xAxis: 'time'
      },
      {
        name: 'Response throughput',
        unit: 'bit/s',
        spans: 3,
        metrics: generateRandomSeries('response_throughput', 450, 150, reporter),
        chartType: 'area',
        xAxis: 'time'
      },
      {
        name: 'gRPC received',
        unit: 'msg/s',
        spans: 3,
        metrics: generateRandomSeries('grpc_received', 5, 2, reporter),
        chartType: 'area',
        xAxis: 'time'
      },
      {
        name: 'gRPC sent',
        unit: 'msg/s',
        spans: 3,
        metrics: generateRandomSeries('grpc_sent', 5, 2, reporter),
        chartType: 'area',
        xAxis: 'time'
      },
      {
        name: 'TCP opened',
        unit: 'conn/s',
        spans: 3,
        metrics: generateRandomSeries('tcp_opened', 0.3, 0.15, reporter),
        chartType: 'area',
        xAxis: 'time'
      },
      {
        name: 'TCP closed',
        unit: 'conn/s',
        spans: 3,
        metrics: generateRandomSeries('tcp_closed', 0.3, 0.15, reporter),
        chartType: 'area',
        xAxis: 'time'
      },
      {
        name: 'TCP received',
        unit: 'bit/s',
        spans: 3,
        metrics: generateRandomSeries('tcp_received', 80, 30, reporter),
        chartType: 'area',
        xAxis: 'time'
      },
      {
        name: 'TCP sent',
        unit: 'bit/s',
        spans: 3,
        metrics: generateRandomSeries('tcp_sent', 70, 25, reporter),
        chartType: 'area',
        xAxis: 'time'
      }
    ],
    aggregations: [
      { label: 'Local version', displayName: 'Local version' },
      { label: 'Remote namespace', displayName: 'Remote namespace' },
      { label: 'Remote app', displayName: 'Remote app' },
      { label: 'Remote version', displayName: 'Remote version' }
    ],
    externalLinks: [],
    rows: 3
  };
};

// Interface for workload list item
interface MockWorkloadListItem {
  appLabel: boolean;
  cluster: string;
  gvk: { Group: string; Kind: string; Version: string };
  health: Record<string, unknown>;
  instanceType: InstanceType;
  isAmbient: boolean;
  isGateway: boolean;
  isWaypoint: boolean;
  isZtunnel: boolean;
  istioReferences: unknown[];
  istioSidecar: boolean;
  labels: { app: string; version: string };
  name: string;
  namespace: string;
  validations?: {
    checks: Array<{ code?: string; message: string; path: string; severity: string }>;
    name: string;
    objectGVK: { Group: string; Kind: string; Version: string };
    valid: boolean;
  };
  versionLabel: boolean;
}

// Interface for service list item
interface MockServiceListItem {
  cluster: string;
  health: Record<string, unknown>;
  instanceType: InstanceType;
  isAmbient: boolean;
  isWaypoint: boolean;
  isZtunnel: boolean;
  istioReferences: unknown[];
  istioSidecar: boolean;
  kialiWizard: string;
  labels: { app: string };
  name: string;
  namespace: string;
  ports: Record<string, number>;
  serviceRegistry: string;
  validation: Record<string, unknown>;
}

// Interface for app list item
interface MockAppListItem {
  cluster: string;
  health: Record<string, unknown>;
  instanceType: InstanceType;
  isAmbient: boolean;
  isGateway: boolean;
  isWaypoint: boolean;
  isZtunnel: boolean;
  istioReferences: unknown[];
  istioSidecar: boolean;
  labels: { app: string };
  name: string;
  namespace: string;
}

// Mock GVK for Deployment
const deploymentGVK = {
  Group: 'apps',
  Kind: 'Deployment',
  Version: 'v1'
};

// Map mock health status to backend status string
const toBackendStatus = (healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'notready'): string => {
  switch (healthStatus) {
    case 'unhealthy':
      return 'Failure';
    case 'degraded':
      return 'Degraded';
    case 'notready':
      return 'Not Ready';
    default:
      return 'Healthy';
  }
};

const createMockWorkloadListItem = (
  name: string,
  namespace: string,
  app: string,
  version: string,
  cluster = 'cluster-default'
): MockWorkloadListItem => {
  const healthStatus = getItemHealthStatus(name, namespace, cluster);
  const errorRate = getScenarioConfig().errorRate;

  // Calculate HTTP responses based on health
  let httpResponses: Record<string, number> = { '200': 100 };
  if (healthStatus === 'unhealthy') {
    httpResponses = { '200': 100 - errorRate - 10, '500': errorRate, '503': 10 };
  } else if (healthStatus === 'degraded') {
    httpResponses = { '200': 100 - Math.floor(errorRate / 2) - 5, '500': Math.floor(errorRate / 2), '503': 5 };
  }

  // Build validations based on health status or specific workload names
  // Always show validations for reviews workloads (for testing), or based on health status
  let validations: MockWorkloadListItem['validations'] = undefined;
  const baseName = name.replace(/-v\d+$/, '');

  if (healthStatus === 'unhealthy' || baseName === 'reviews') {
    // Reviews workloads always show errors for testing visibility
    validations = {
      name,
      objectGVK: deploymentGVK,
      valid: false,
      checks: [
        {
          code: 'KIA1004',
          message: 'This subset is not found from the host',
          path: 'spec/subsets[0]',
          severity: 'error'
        },
        {
          code: 'KIA1006',
          message: 'More than one Virtual Service for same host',
          path: 'spec/hosts',
          severity: 'error'
        }
      ]
    };
  } else if (healthStatus === 'degraded' || baseName === 'ratings') {
    // Ratings workloads always show warnings for testing visibility
    validations = {
      name,
      objectGVK: deploymentGVK,
      valid: false,
      checks: [
        {
          code: 'KIA0505',
          message: 'Destination Rule enabling namespace-wide mTLS is missing',
          path: '',
          severity: 'warning'
        }
      ]
    };
  }

  // Not ready status means workload is scaled down (desiredReplicas = 0)
  const isNotReady = healthStatus === 'notready';
  const isUnhealthy = healthStatus === 'unhealthy';

  const ambientEnabled = getScenarioConfig().ambientEnabled;
  const isZtunnel = ambientEnabled && name === 'ztunnel';
  const isWaypoint = ambientEnabled && name === 'waypoint';

  return {
    name,
    namespace,
    cluster,
    gvk: isZtunnel ? { Group: 'apps', Kind: 'DaemonSet', Version: 'v1' } : deploymentGVK,
    instanceType: InstanceType.Workload,
    istioSidecar: !isZtunnel,
    isAmbient: ambientEnabled && !namespace.includes('istio-system'),
    isGateway: false,
    isWaypoint,
    isZtunnel,
    istioReferences: [],
    labels: {
      app,
      version,
      ...(isWaypoint ? { 'istio.io/waypoint-for': 'all' } : {}),
      ...(isZtunnel ? { 'sidecar.istio.io/inject': 'false' } : {})
    },
    appLabel: true,
    versionLabel: true,
    validations,
    health: {
      workloadStatus: {
        name,
        desiredReplicas: isNotReady ? 0 : 1,
        currentReplicas: isNotReady ? 0 : 1,
        availableReplicas: isNotReady || isUnhealthy ? 0 : 1,
        syncedProxies: isNotReady || isUnhealthy ? 0 : 1
      },
      requests: {
        inbound: { http: httpResponses },
        outbound: { http: httpResponses },
        healthAnnotations: {}
      },
      // Backend-calculated status - this is what Health.getStatus() uses
      status: {
        status: toBackendStatus(healthStatus),
        errorRatio: healthStatus === 'unhealthy' ? errorRate : healthStatus === 'degraded' ? errorRate / 2 : 0
      }
    }
  };
};

// GVK for Service
const serviceGVK = {
  Group: '',
  Kind: 'Service',
  Version: 'v1'
};

const createMockServiceListItem = (
  name: string,
  namespace: string,
  cluster = 'cluster-default'
): MockServiceListItem => {
  const healthStatus = getItemHealthStatus(name, namespace, cluster);
  const errorRate = getScenarioConfig().errorRate;

  // Calculate HTTP responses based on health
  let httpResponses: Record<string, number> = { '200': 100 };
  if (healthStatus === 'unhealthy') {
    httpResponses = { '200': 100 - errorRate - 10, '500': errorRate, '503': 10 };
  } else if (healthStatus === 'degraded') {
    httpResponses = { '200': 100 - Math.floor(errorRate / 2) - 5, '500': Math.floor(errorRate / 2), '503': 5 };
  }

  return {
    name,
    namespace,
    cluster,
    instanceType: InstanceType.Service,
    istioSidecar: true,
    isAmbient: false,
    isWaypoint: false,
    isZtunnel: false,
    istioReferences: [],
    kialiWizard: '',
    serviceRegistry: 'Kubernetes',
    labels: {
      app: name
    },
    ports: {
      http: 9080
    },
    health: {
      requests: {
        inbound: { http: httpResponses },
        outbound: { http: httpResponses },
        healthAnnotations: {}
      },
      // Backend-calculated status - this is what Health.getStatus() uses
      status: {
        status: toBackendStatus(healthStatus),
        errorRatio: healthStatus === 'unhealthy' ? errorRate : healthStatus === 'degraded' ? errorRate / 2 : 0
      }
    },
    validation: {
      name: name,
      objectGVK: serviceGVK,
      valid: healthStatus !== 'unhealthy',
      checks:
        healthStatus === 'unhealthy' ? [{ message: 'Service has high error rate', severity: 'error', path: '' }] : []
    }
  };
};

const createMockAppListItem = (name: string, namespace: string, cluster = 'cluster-default'): MockAppListItem => {
  const healthStatus = getItemHealthStatus(name, namespace, cluster);
  const errorRate = getScenarioConfig().errorRate;

  // Calculate HTTP responses based on health
  let httpResponses: Record<string, number> = { '200': 100 };
  if (healthStatus === 'unhealthy') {
    httpResponses = { '200': 100 - errorRate - 10, '500': errorRate, '503': 10 };
  } else if (healthStatus === 'degraded') {
    httpResponses = { '200': 100 - Math.floor(errorRate / 2) - 5, '500': Math.floor(errorRate / 2), '503': 5 };
  }

  // Not ready status means workload is scaled down (desiredReplicas = 0)
  const isNotReady = healthStatus === 'notready';
  const isUnhealthy = healthStatus === 'unhealthy';

  return {
    name,
    namespace,
    cluster,
    instanceType: InstanceType.App,
    istioSidecar: true,
    isAmbient: false,
    isGateway: false,
    isWaypoint: false,
    isZtunnel: false,
    istioReferences: [],
    labels: {
      app: name
    },
    health: {
      requests: {
        inbound: { http: httpResponses },
        outbound: { http: httpResponses },
        healthAnnotations: {}
      },
      workloadStatuses: [
        {
          name: `${name}-v1`,
          desiredReplicas: isNotReady ? 0 : 1,
          currentReplicas: isNotReady ? 0 : 1,
          availableReplicas: isNotReady || isUnhealthy ? 0 : 1,
          syncedProxies: isNotReady || isUnhealthy ? 0 : 1
        }
      ],
      // Backend-calculated status - this is what Health.getStatus() uses
      status: {
        status: toBackendStatus(healthStatus),
        errorRatio: healthStatus === 'unhealthy' ? errorRate : healthStatus === 'degraded' ? errorRate / 2 : 0
      }
    }
  };
};

// Workload definitions per namespace (base templates)
const workloadDefinitions: Record<string, Array<{ app: string; name: string; version: string }>> = {
  alpha: [
    { name: 'alpha-api-v1', app: 'alpha-api', version: 'v1' },
    { name: 'alpha-worker-v1', app: 'alpha-worker', version: 'v1' }
  ],
  beta: [
    { name: 'beta-api-v1', app: 'beta-api', version: 'v1' },
    { name: 'beta-db-v1', app: 'beta-db', version: 'v1' }
  ],
  bookinfo: [
    { name: 'productpage-v1', app: 'productpage', version: 'v1' },
    { name: 'details-v1', app: 'details', version: 'v1' },
    { name: 'reviews-v1', app: 'reviews', version: 'v1' },
    { name: 'reviews-v2', app: 'reviews', version: 'v2' },
    { name: 'reviews-v3', app: 'reviews', version: 'v3' },
    { name: 'ratings-v1', app: 'ratings', version: 'v1' }
  ],
  default: [
    { name: 'httpbin-v1', app: 'httpbin', version: 'v1' },
    { name: 'sleep-v1', app: 'sleep', version: 'v1' }
  ],
  gamma: [
    { name: 'gamma-frontend-v1', app: 'gamma-frontend', version: 'v1' },
    { name: 'gamma-backend-v1', app: 'gamma-backend', version: 'v1' }
  ],
  'istio-system': [
    { name: 'istiod', app: 'istiod', version: 'default' },
    { name: 'istio-ingressgateway', app: 'istio-ingressgateway', version: 'default' },
    { name: 'ztunnel', app: 'ztunnel', version: 'default' },
    { name: 'waypoint', app: 'waypoint', version: 'default' }
  ],
  'travel-agency': [
    { name: 'travels-v1', app: 'travels', version: 'v1' },
    { name: 'hotels-v1', app: 'hotels', version: 'v1' },
    { name: 'cars-v1', app: 'cars', version: 'v1' },
    { name: 'flights-v1', app: 'flights', version: 'v1' }
  ],
  'travel-control': [
    { name: 'control-v1', app: 'control', version: 'v1' },
    { name: 'mysqldb-v1', app: 'mysqldb', version: 'v1' }
  ],
  'travel-portal': [
    { name: 'voyages-v1', app: 'voyages', version: 'v1' },
    { name: 'viaggi-v1', app: 'viaggi', version: 'v1' }
  ]
};

// Generate workloads for all clusters based on scenario configuration
const getAllWorkloads = (): MockWorkloadListItem[] => {
  const scenarioConfig = getScenarioConfig();
  const workloads: MockWorkloadListItem[] = [];

  scenarioConfig.clusters.forEach(cluster => {
    // Skip inaccessible clusters
    if (!cluster.accessible) return;

    cluster.namespaces.forEach(namespace => {
      const definitions = workloadDefinitions[namespace] || [];
      definitions.forEach(def => {
        workloads.push(createMockWorkloadListItem(def.name, namespace, def.app, def.version, cluster.name));
      });
    });
  });

  return workloads;
};

// Generate workloads dynamically based on scenario - called per request (legacy support)
const getWorkloadsByNamespace = (): Record<string, MockWorkloadListItem[]> => {
  const allWorkloads = getAllWorkloads();
  const byNamespace: Record<string, MockWorkloadListItem[]> = {};

  allWorkloads.forEach(wl => {
    if (!byNamespace[wl.namespace]) {
      byNamespace[wl.namespace] = [];
    }
    byNamespace[wl.namespace].push(wl);
  });

  return byNamespace;
};

// Service definitions per namespace (base templates)
const serviceDefinitions: Record<string, string[]> = {
  alpha: ['alpha-api', 'alpha-worker'],
  beta: ['beta-api', 'beta-db'],
  bookinfo: ['productpage', 'details', 'reviews', 'ratings'],
  default: ['httpbin', 'sleep'],
  gamma: ['gamma-frontend', 'gamma-backend'],
  'istio-system': ['istiod', 'istio-ingressgateway'],
  'travel-agency': ['travels', 'hotels', 'cars', 'flights'],
  'travel-control': ['control', 'mysqldb'],
  'travel-portal': ['voyages', 'viaggi']
};

// Generate services for all clusters based on scenario configuration
const getAllServices = (): MockServiceListItem[] => {
  const scenarioConfig = getScenarioConfig();
  const services: MockServiceListItem[] = [];

  scenarioConfig.clusters.forEach(cluster => {
    if (!cluster.accessible) return;

    cluster.namespaces.forEach(namespace => {
      const definitions = serviceDefinitions[namespace] || [];
      definitions.forEach(name => {
        services.push(createMockServiceListItem(name, namespace, cluster.name));
      });
    });
  });

  return services;
};

// Generate services dynamically based on scenario - called per request (legacy support)
const getServicesByNamespace = (): Record<string, MockServiceListItem[]> => {
  const allServices = getAllServices();
  const byNamespace: Record<string, MockServiceListItem[]> = {};

  allServices.forEach(svc => {
    if (!byNamespace[svc.namespace]) {
      byNamespace[svc.namespace] = [];
    }
    byNamespace[svc.namespace].push(svc);
  });

  return byNamespace;
};

// App definitions per namespace (same as services)
const appDefinitions = serviceDefinitions;

// Generate apps for all clusters based on scenario configuration
const getAllApps = (): MockAppListItem[] => {
  const scenarioConfig = getScenarioConfig();
  const apps: MockAppListItem[] = [];

  scenarioConfig.clusters.forEach(cluster => {
    if (!cluster.accessible) return;

    cluster.namespaces.forEach(namespace => {
      const definitions = appDefinitions[namespace] || [];
      definitions.forEach(name => {
        apps.push(createMockAppListItem(name, namespace, cluster.name));
      });
    });
  });

  return apps;
};

// Generate apps dynamically based on scenario - called per request (legacy support)
const getAppsByNamespace = (): Record<string, MockAppListItem[]> => {
  const allApps = getAllApps();
  const byNamespace: Record<string, MockAppListItem[]> = {};

  allApps.forEach(app => {
    if (!byNamespace[app.namespace]) {
      byNamespace[app.namespace] = [];
    }
    byNamespace[app.namespace].push(app);
  });

  return byNamespace;
};

// Helper to get workloads for requested namespaces - generates fresh data per request
const getWorkloadsForNamespaces = (namespaces: string): MockWorkloadListItem[] => {
  const nsList = namespaces.split(',').map(ns => ns.trim());
  const workloadsByNamespace = getWorkloadsByNamespace();
  return nsList.flatMap(ns => workloadsByNamespace[ns] || []);
};

const getServicesForNamespaces = (namespaces: string): MockServiceListItem[] => {
  const nsList = namespaces.split(',').map(ns => ns.trim());
  const servicesByNamespace = getServicesByNamespace();
  return nsList.flatMap(ns => servicesByNamespace[ns] || []);
};

const getAppsForNamespaces = (namespaces: string): MockAppListItem[] => {
  const nsList = namespaces.split(',').map(ns => ns.trim());
  const appsByNamespace = getAppsByNamespace();
  return nsList.flatMap(ns => appsByNamespace[ns] || []);
};

export const workloadHandlers = [
  // Clusters workloads - main endpoint for workload list
  http.get('*/api/clusters/workloads', async ({ request }) => {
    await delay(getResponseDelay());

    if (shouldApiTimeout('workloads')) {
      return HttpResponse.json({ error: 'Request timeout: failed to fetch workloads' }, { status: 504 });
    }

    // Return empty workloads if configured
    if (shouldApiReturnEmpty('workloads')) {
      return HttpResponse.json({
        cluster: 'cluster-default',
        workloads: [],
        validations: { workload: {} }
      });
    }

    const url = new URL(request.url);
    const namespaces = url.searchParams.get('namespaces') || 'bookinfo';
    const workloads = getWorkloadsForNamespaces(namespaces);

    // Build validations map: { workload: { "name.namespace": ObjectValidation } }
    const workloadValidations: Record<string, Record<string, unknown>> = {
      workload: {}
    };
    workloads.forEach(wl => {
      if (wl.validations) {
        const key = `${wl.name}.${wl.namespace}`;
        workloadValidations.workload[key] = wl.validations;
      }
    });

    return HttpResponse.json({
      cluster: 'cluster-default',
      workloads,
      validations: workloadValidations
    });
  }),

  // Clusters services
  http.get('*/api/clusters/services', ({ request }) => {
    const url = new URL(request.url);
    const namespaces = url.searchParams.get('namespaces') || 'bookinfo';
    const services = getServicesForNamespaces(namespaces);

    // Build validations map: { service: { "name.namespace": ObjectValidation } }
    const serviceValidations: Record<string, Record<string, unknown>> = {
      service: {}
    };
    services.forEach(svc => {
      const key = `${svc.name}.${svc.namespace}`;
      serviceValidations.service[key] = {
        name: svc.name,
        objectGVK: serviceGVK,
        valid: true,
        checks: []
      };
    });

    return HttpResponse.json({
      cluster: 'cluster-default',
      services,
      validations: serviceValidations
    });
  }),

  // Clusters apps
  http.get('*/api/clusters/apps', async ({ request }) => {
    await delay(getResponseDelay());

    if (shouldApiTimeout('applications')) {
      return HttpResponse.json({ error: 'Request timeout: failed to fetch applications' }, { status: 504 });
    }

    // Return empty applications if configured
    if (shouldApiReturnEmpty('applications')) {
      return HttpResponse.json({
        cluster: 'cluster-default',
        applications: []
      });
    }

    const url = new URL(request.url);
    const namespaces = url.searchParams.get('namespaces') || 'bookinfo';
    const applications = getAppsForNamespaces(namespaces);

    return HttpResponse.json({
      cluster: 'cluster-default',
      applications
    });
  }),

  // Namespace workloads
  http.get('*/api/namespaces/:namespace/workloads', ({ params }) => {
    const { namespace } = params;
    const workloadsByNamespace = getWorkloadsByNamespace();
    const workloads = workloadsByNamespace[namespace as string] || [];

    // Build validations map: { workload: { "name.namespace": ObjectValidation } }
    const workloadValidations: Record<string, Record<string, unknown>> = {
      workload: {}
    };
    workloads.forEach(wl => {
      if (wl.validations) {
        const key = `${wl.name}.${wl.namespace}`;
        workloadValidations.workload[key] = wl.validations;
      }
    });

    return HttpResponse.json({
      cluster: 'cluster-default',
      namespace,
      workloads,
      validations: workloadValidations
    });
  }),

  // Workload detail
  http.get('*/api/namespaces/:namespace/workloads/:workload', ({ params }) => {
    const { workload, namespace } = params;
    const workloadsByNamespace = getWorkloadsByNamespace();
    const nsWorkloads = workloadsByNamespace[namespace as string] || workloadsByNamespace['bookinfo'];
    const found = nsWorkloads.find(w => w.name === workload);

    if (found) {
      // Build validations in the expected format: { workload: { "name.namespace": ObjectValidation } }
      const validationKey = `${workload}.${namespace}`;
      const workloadValidations = {
        workload: {
          [validationKey]: {
            name: workload,
            objectGVK: deploymentGVK,
            valid: true,
            checks: []
          }
        }
      };

      const istioContainers = found.isZtunnel ? [] : [{ name: 'istio-proxy', image: 'docker.io/istio/proxyv2:1.20.0' }];
      const istioInitContainers = found.isZtunnel
        ? []
        : [{ name: 'istio-init', image: 'docker.io/istio/proxyv2:1.20.0' }];
      const runtimes = found.isZtunnel
        ? []
        : [{ name: 'envoy', dashboardRefs: [{ template: 'envoy', title: 'Envoy Metrics' }] }];

      return HttpResponse.json({
        ...found,
        createdAt: new Date().toISOString(),
        resourceVersion: '12345',
        type: found.isZtunnel ? 'DaemonSet' : 'Deployment',
        istioInjectionAnnotation: !found.isZtunnel,
        podCount: found.isZtunnel ? 3 : 1,
        annotations: {},
        healthAnnotations: {},
        additionalDetails: [],
        serviceAccountNames: [`${found.labels.app}-service-account`],
        pods: [
          {
            name: `${workload}-abc123`,
            labels: found.labels,
            createdAt: new Date().toISOString(),
            createdBy: [{ name: workload as string, kind: found.isZtunnel ? 'DaemonSet' : 'Deployment' }],
            istioContainers,
            istioInitContainers,
            status: 'Running',
            statusMessage: '',
            statusReason: '',
            appLabel: true,
            versionLabel: true,
            containers: [{ name: found.labels.app, image: `${found.labels.app}:1.0` }],
            serviceAccountName: `${found.labels.app}-service-account`
          }
        ],
        services: [createMockServiceListItem(found.labels.app, namespace as string)],
        runtimes,
        validations: workloadValidations,
        waypointServices: found.isWaypoint
          ? [
              { name: 'productpage', namespace: 'bookinfo' },
              { name: 'reviews', namespace: 'bookinfo' },
              { name: 'ratings', namespace: 'bookinfo' },
              { name: 'details', namespace: 'bookinfo' }
            ]
          : [],
        waypointWorkloads: found.isWaypoint
          ? [
              { name: 'reviews-v1', namespace: 'bookinfo' },
              { name: 'ratings-v1', namespace: 'bookinfo' },
              { name: 'productpage-v1', namespace: 'bookinfo' }
            ]
          : []
      });
    }

    return HttpResponse.json({ error: 'Workload not found' }, { status: 404 });
  }),

  // Namespace services
  http.get('*/api/namespaces/:namespace/services', ({ params }) => {
    const { namespace } = params;
    const servicesByNamespace = getServicesByNamespace();
    const services = servicesByNamespace[namespace as string] || [];

    // Build validations map
    const serviceValidations: Record<string, Record<string, unknown>> = {
      service: {}
    };
    services.forEach(svc => {
      const key = `${svc.name}.${svc.namespace}`;
      serviceValidations.service[key] = {
        name: svc.name,
        objectGVK: serviceGVK,
        valid: svc.validation.valid,
        checks: svc.validation.checks
      };
    });

    return HttpResponse.json({
      cluster: 'cluster-default',
      namespace,
      services,
      validations: serviceValidations
    });
  }),

  // Service detail
  http.get('*/api/namespaces/:namespace/services/:service', ({ params }) => {
    const { service, namespace } = params;
    const servicesByNamespace = getServicesByNamespace();
    const nsServices = servicesByNamespace[namespace as string] || servicesByNamespace['bookinfo'];
    const found = nsServices.find(s => s.name === service);

    if (found) {
      const workloadsByNamespace = getWorkloadsByNamespace();
      const nsWorkloads = workloadsByNamespace[namespace as string] || [];
      const relatedWorkloads = nsWorkloads
        .filter(w => w.labels.app === service)
        .map(w => ({
          name: w.name,
          namespace: namespace as string,
          createdAt: new Date().toISOString(),
          resourceVersion: '12345',
          type: 'Deployment',
          istioSidecar: true,
          isAmbient: false,
          isGateway: false,
          isWaypoint: false,
          isZtunnel: false,
          labels: w.labels,
          serviceAccountNames: [`${w.labels.app}-service-account`]
        }));

      return HttpResponse.json({
        service: {
          name: service,
          namespace: namespace,
          cluster: 'cluster-default',
          createdAt: new Date().toISOString(),
          resourceVersion: '12345',
          type: 'ClusterIP',
          ip: '10.96.0.10',
          externalName: '',
          labels: { app: service },
          selectors: { app: service },
          ports: [
            {
              name: 'http',
              port: 9080,
              protocol: 'TCP',
              appProtocol: 'http',
              istioProtocol: 'http',
              tlsMode: 'istio'
            }
          ],
          annotations: {},
          additionalDetails: []
        },
        endpoints: [
          {
            addresses: [
              {
                ip: '10.244.0.10',
                kind: 'Pod',
                name: `${service}-v1-abc123`,
                istioProtocol: 'http',
                tlsMode: 'istio'
              }
            ],
            ports: [
              {
                name: 'http',
                port: 9080,
                protocol: 'TCP',
                appProtocol: 'http',
                istioProtocol: 'http',
                tlsMode: 'istio'
              }
            ]
          }
        ],
        workloads: relatedWorkloads,
        virtualServices: [],
        destinationRules: [],
        k8sHTTPRoutes: [],
        k8sGRPCRoutes: [],
        k8sInferencePools: [],
        serviceEntries: [],
        istioSidecar: true,
        isAmbient: false,
        istioPermissions: {
          create: true,
          update: true,
          delete: true
        },
        namespaceMTLS: {
          status: 'ENABLED',
          autoMTLSEnabled: true,
          minTLS: 'N/A'
        },
        validations: {
          [service as string]: {
            name: service,
            objectType: 'service',
            valid: true,
            checks: []
          }
        },
        health: {
          requests: {
            inbound: { http: { '200': 100 } },
            outbound: { http: { '200': 100 } },
            healthAnnotations: {}
          }
        }
      });
    }

    return HttpResponse.json({ error: 'Service not found' }, { status: 404 });
  }),

  // Namespace apps
  http.get('*/api/namespaces/:namespace/apps', ({ params }) => {
    const { namespace } = params;
    const appsByNamespace = getAppsByNamespace();
    const applications = appsByNamespace[namespace as string] || [];

    return HttpResponse.json({
      cluster: 'cluster-default',
      namespace,
      applications
    });
  }),

  // App detail
  http.get('*/api/namespaces/:namespace/apps/:app', ({ params }) => {
    const { app, namespace } = params;
    const appsByNamespace = getAppsByNamespace();
    const nsApps = appsByNamespace[namespace as string] || appsByNamespace['bookinfo'];
    const found = nsApps.find(a => a.name === app);

    if (found) {
      const workloadsByNamespace = getWorkloadsByNamespace();
      const nsWorkloads = workloadsByNamespace[namespace as string] || [];
      const relatedWorkloads = nsWorkloads.filter(w => w.labels.app === app);

      // Transform workloads to AppWorkload format
      const appWorkloads = relatedWorkloads.map(w => ({
        workloadName: w.name,
        gvk: w.gvk,
        isAmbient: w.isAmbient,
        isGateway: w.isGateway,
        isWaypoint: w.isWaypoint,
        isZtunnel: w.isZtunnel,
        istioSidecar: w.istioSidecar,
        labels: w.labels,
        namespace: w.namespace,
        serviceAccountNames: [`${w.labels.app}-service-account`]
      }));

      return HttpResponse.json({
        name: found.name,
        cluster: found.cluster,
        instanceType: found.instanceType,
        isAmbient: found.isAmbient,
        health: found.health,
        namespace: { name: namespace, cluster: 'cluster-default' },
        workloads: appWorkloads,
        serviceNames: [app],
        runtimes: []
      });
    }

    return HttpResponse.json({ error: 'App not found' }, { status: 404 });
  }),

  // Helper to generate metric datapoints
  // Metrics endpoints with mock data
  http.get('*/api/namespaces/:namespace/workloads/:workload/metrics', ({ request }) => {
    const url = new URL(request.url);
    const direction = url.searchParams.get('direction') || 'inbound';
    return HttpResponse.json(generateMockMetrics(direction));
  }),

  http.get('*/api/namespaces/:namespace/workloads/:workload/dashboard', ({ request }) => {
    const url = new URL(request.url);
    const direction = url.searchParams.get('direction') || 'inbound';
    return HttpResponse.json(generateMockDashboard('Workload', direction));
  }),

  http.get('*/api/namespaces/:namespace/services/:service/metrics', ({ request }) => {
    const url = new URL(request.url);
    const direction = url.searchParams.get('direction') || 'inbound';
    return HttpResponse.json(generateMockMetrics(direction));
  }),

  http.get('*/api/namespaces/:namespace/services/:service/dashboard', ({ request }) => {
    const url = new URL(request.url);
    const direction = url.searchParams.get('direction') || 'inbound';
    return HttpResponse.json(generateMockDashboard('Service', direction));
  }),

  http.get('*/api/namespaces/:namespace/apps/:app/metrics', ({ request }) => {
    const url = new URL(request.url);
    const direction = url.searchParams.get('direction') || 'inbound';
    return HttpResponse.json(generateMockMetrics(direction));
  }),

  http.get('*/api/namespaces/:namespace/apps/:app/dashboard', ({ request }) => {
    const url = new URL(request.url);
    const direction = url.searchParams.get('direction') || 'inbound';
    return HttpResponse.json(generateMockDashboard('App', direction));
  }),

  // Custom dashboard (used by Envoy metrics sub-tab with template=envoy, and any workload with custom dashboards)
  http.get('*/api/namespaces/:namespace/customdashboard/:template', ({ params, request }) => {
    const { template } = params;
    const url = new URL(request.url);
    const direction = url.searchParams.get('direction') || 'inbound';
    return HttpResponse.json(generateMockDashboard(String(template), direction));
  }),

  // Ztunnel dashboard (ambient mesh metrics)
  http.get('*/api/namespaces/:namespace/ztunnel/:controlPlane/dashboard', ({ request }) => {
    const url = new URL(request.url);
    const direction = url.searchParams.get('direction') || 'inbound';
    return HttpResponse.json(generateMockDashboard('Ztunnel', direction));
  }),

  // Clusters metrics
  http.get('*/api/clusters/metrics', () => {
    return HttpResponse.json(generateMockMetrics('inbound'));
  }),

  // Pod envoy proxy config dump
  http.get('*/api/namespaces/:namespace/pods/:pod/config_dump', ({ params }) => {
    const { namespace } = params;
    return HttpResponse.json({
      bootstrap: {
        bootstrap: {
          node: {
            id: `sidecar~10.244.0.10~${params.pod}.${namespace}~${namespace}.svc.cluster.local`
          }
        }
      },
      clusters: [
        {
          service_fqdn: { cluster: 'cluster-default', namespace: namespace as string, service: 'details' },
          port: 9080,
          subset: '',
          direction: 'outbound',
          type: 'EDS',
          destination_rule: ''
        },
        {
          service_fqdn: { cluster: 'cluster-default', namespace: namespace as string, service: 'reviews' },
          port: 9080,
          subset: '',
          direction: 'outbound',
          type: 'EDS',
          destination_rule: ''
        },
        {
          service_fqdn: { cluster: 'cluster-default', namespace: namespace as string, service: 'ratings' },
          port: 9080,
          subset: '',
          direction: 'outbound',
          type: 'EDS',
          destination_rule: ''
        },
        {
          service_fqdn: { cluster: 'cluster-default', namespace: namespace as string, service: 'productpage' },
          port: 9080,
          subset: '',
          direction: 'inbound',
          type: 'ORIGINAL_DST',
          destination_rule: ''
        }
      ],
      listeners: [
        {
          address: '0.0.0.0',
          port: 15006,
          match: 'ALL',
          destination: 'Inline Route: /*'
        },
        {
          address: '0.0.0.0',
          port: 15001,
          match: 'ALL',
          destination: 'Inline Route: /*'
        },
        {
          address: '10.96.0.1',
          port: 443,
          match: 'ALL',
          destination: 'Cluster: outbound|443||kubernetes.default.svc.cluster.local'
        }
      ],
      routes: [
        {
          name: '9080',
          domains: { cluster: 'cluster-default', namespace: namespace as string, service: 'details' },
          match: '/*',
          virtual_service: ''
        },
        {
          name: '9080',
          domains: { cluster: 'cluster-default', namespace: namespace as string, service: 'reviews' },
          match: '/*',
          virtual_service: ''
        }
      ]
    });
  }),

  // Pod envoy proxy config dump for specific resource
  http.get('*/api/namespaces/:namespace/pods/:pod/config_dump/:resource', ({ params }) => {
    const { resource, namespace } = params;

    // Return mock data based on resource type - same structure as above
    if (resource === 'clusters') {
      return HttpResponse.json({
        clusters: [
          {
            service_fqdn: { cluster: 'cluster-default', namespace: namespace as string, service: 'details' },
            port: 9080,
            subset: '',
            direction: 'outbound',
            type: 'EDS',
            destination_rule: ''
          },
          {
            service_fqdn: { cluster: 'cluster-default', namespace: namespace as string, service: 'reviews' },
            port: 9080,
            subset: '',
            direction: 'outbound',
            type: 'EDS',
            destination_rule: ''
          },
          {
            service_fqdn: { cluster: 'cluster-default', namespace: namespace as string, service: 'ratings' },
            port: 9080,
            subset: '',
            direction: 'outbound',
            type: 'EDS',
            destination_rule: ''
          },
          {
            service_fqdn: { cluster: 'cluster-default', namespace: namespace as string, service: 'productpage' },
            port: 9080,
            subset: '',
            direction: 'inbound',
            type: 'ORIGINAL_DST',
            destination_rule: ''
          }
        ]
      });
    }

    if (resource === 'listeners') {
      return HttpResponse.json({
        listeners: [
          {
            address: '0.0.0.0',
            port: 15006,
            match: 'ALL',
            destination: 'Inline Route: /*'
          },
          {
            address: '0.0.0.0',
            port: 15001,
            match: 'ALL',
            destination: 'Inline Route: /*'
          },
          {
            address: '10.96.0.1',
            port: 443,
            match: 'ALL',
            destination: 'Cluster: outbound|443||kubernetes.default.svc.cluster.local'
          }
        ]
      });
    }

    if (resource === 'routes') {
      return HttpResponse.json({
        routes: [
          {
            name: '9080',
            domains: { cluster: 'cluster-default', namespace: namespace as string, service: 'details' },
            match: '/*',
            virtual_service: ''
          },
          {
            name: '9080',
            domains: { cluster: 'cluster-default', namespace: namespace as string, service: 'reviews' },
            match: '/*',
            virtual_service: ''
          }
        ]
      });
    }

    if (resource === 'bootstrap') {
      return HttpResponse.json({
        bootstrap: {
          bootstrap: {
            node: {
              id: `sidecar~10.244.0.10~${params.pod}.${namespace}~${namespace}.svc.cluster.local`
            }
          }
        }
      });
    }

    // Default empty response for other resources
    return HttpResponse.json({});
  }),

  // Pod ztunnel config dump
  http.get('*/api/namespaces/:namespace/pods/:pod/config_dump_ztunnel', () => {
    return HttpResponse.json({
      services: [
        {
          name: 'productpage',
          namespace: 'bookinfo',
          hostname: 'productpage.bookinfo.svc.cluster.local',
          vips: ['10.96.10.1'],
          ports: { http: 9080 },
          endpoints: {
            'uid-productpage-v1': { workloadUid: 'uid-productpage-v1', status: 'Healthy', port: { http: 9080 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/bookinfo/sa/bookinfo-productpage'],
          ipFamilies: 'IPv4',
          waypoint: { destination: '', hboneMtlsPort: 0 }
        },
        {
          name: 'reviews',
          namespace: 'bookinfo',
          hostname: 'reviews.bookinfo.svc.cluster.local',
          vips: ['10.96.10.2'],
          ports: { http: 9080 },
          endpoints: {
            'uid-reviews-v1': { workloadUid: 'uid-reviews-v1', status: 'Healthy', port: { http: 9080 } },
            'uid-reviews-v2': { workloadUid: 'uid-reviews-v2', status: 'Healthy', port: { http: 9080 } },
            'uid-reviews-v3': { workloadUid: 'uid-reviews-v3', status: 'Healthy', port: { http: 9080 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/bookinfo/sa/bookinfo-reviews'],
          ipFamilies: 'IPv4',
          waypoint: { destination: 'waypoint.istio-system.svc.cluster.local', hboneMtlsPort: 15008 }
        },
        {
          name: 'ratings',
          namespace: 'bookinfo',
          hostname: 'ratings.bookinfo.svc.cluster.local',
          vips: ['10.96.10.3'],
          ports: { http: 9080 },
          endpoints: {
            'uid-ratings-v1': { workloadUid: 'uid-ratings-v1', status: 'Healthy', port: { http: 9080 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/bookinfo/sa/bookinfo-ratings'],
          ipFamilies: 'IPv4',
          waypoint: { destination: '', hboneMtlsPort: 0 }
        },
        {
          name: 'details',
          namespace: 'bookinfo',
          hostname: 'details.bookinfo.svc.cluster.local',
          vips: ['10.96.10.4'],
          ports: { http: 9080 },
          endpoints: {
            'uid-details-v1': { workloadUid: 'uid-details-v1', status: 'Healthy', port: { http: 9080 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/bookinfo/sa/bookinfo-details'],
          ipFamilies: 'IPv4',
          waypoint: { destination: '', hboneMtlsPort: 0 }
        }
      ],
      workloads: [
        {
          name: 'productpage-v1-abc123',
          namespace: 'bookinfo',
          workloadName: 'productpage-v1',
          workloadType: 'deployment',
          canonicalName: 'productpage',
          canonicalRevision: 'v1',
          node: 'node-1',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'bookinfo-productpage',
          uid: 'uid-productpage-v1',
          workloadIps: ['10.244.0.10'],
          services: ['bookinfo/productpage']
        },
        {
          name: 'reviews-v1-def456',
          namespace: 'bookinfo',
          workloadName: 'reviews-v1',
          workloadType: 'deployment',
          canonicalName: 'reviews',
          canonicalRevision: 'v1',
          node: 'node-1',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'bookinfo-reviews',
          uid: 'uid-reviews-v1',
          workloadIps: ['10.244.0.11'],
          services: ['bookinfo/reviews']
        },
        {
          name: 'ratings-v1-ghi789',
          namespace: 'bookinfo',
          workloadName: 'ratings-v1',
          workloadType: 'deployment',
          canonicalName: 'ratings',
          canonicalRevision: 'v1',
          node: 'node-2',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'bookinfo-ratings',
          uid: 'uid-ratings-v1',
          workloadIps: ['10.244.1.10'],
          services: ['bookinfo/ratings']
        }
      ],
      policies: [],
      certificates: [
        {
          identity: 'spiffe://cluster.local/ns/bookinfo/sa/bookinfo-productpage',
          state: 'Available',
          certChain: [
            {
              validFrom: new Date(Date.now() - 86400000).toISOString(),
              expirationTime: new Date(Date.now() + 86400000 * 30).toISOString(),
              serialNumber: 'a1b2c3d4e5f6',
              pem: '-----BEGIN CERTIFICATE-----\nMIIC...(truncated)\n-----END CERTIFICATE-----'
            }
          ]
        }
      ]
    });
  }),

  // Pod logging endpoint
  http.get('*/api/namespaces/:namespace/pods/:pod/logging', () => {
    return HttpResponse.json({
      loggers: {
        'envoy.http': 'warning',
        'envoy.upstream': 'warning',
        'envoy.connection': 'warning'
      }
    });
  }),

  // Pod logs endpoint
  http.get('*/api/namespaces/:namespace/pods/:pod/logs', ({ request }) => {
    const url = new URL(request.url);
    const logType = url.searchParams.get('logType') || 'app';
    const baseTime = Math.floor(Date.now() / 1000) - 300;

    const appMessages = [
      'Starting application server on port 9080',
      'Connected to database cluster at mongodb:27017',
      'Health check endpoint /health registered',
      'Loading product catalog from cache',
      '{"level":"info","ts":1719500000.123,"caller":"server/main.go:42","msg":"Received request","method":"GET","path":"/api/v1/products","remote_addr":"10.244.0.1:47832","latency_ms":23,"status":200}',
      'Cache miss for key product:42, fetching from DB',
      'Successfully retrieved 15 products in 23ms',
      '{"level":"warn","ts":1719500015.456,"caller":"db/query.go:118","msg":"Slow query detected","query":"SELECT * FROM reviews WHERE product_id=42","duration_ms":250,"rows_scanned":15000,"rows_returned":3}',
      'Upstream service ratings:9080 responded in 12ms',
      'Received request for /api/v1/details?isbn=0123456789',
      'Connection pool stats: active=3 idle=7 max=10',
      'Slow query detected: SELECT * FROM reviews WHERE product_id=42 took 250ms',
      'Retry attempt 1/3 for upstream service ratings',
      '{"level":"error","ts":1719500045.789,"caller":"circuit/breaker.go:67","msg":"Circuit breaker tripped","service":"ratings","consecutive_failures":5,"state":"OPEN","half_open_after":"30s","last_error":"connection refused"}',
      'Request /api/v1/products completed in 145ms',
      'GC pause: 12ms (young generation)',
      'Received SIGTERM, starting graceful shutdown',
      'Draining connections, 3 active requests remaining',
      'All connections drained, shutting down',
      'Application server stopped'
    ];

    const severities = [
      'INFO',
      'INFO',
      'INFO',
      'INFO',
      'INFO',
      'INFO',
      'INFO',
      'WARN',
      'INFO',
      'INFO',
      'INFO',
      'WARN',
      'WARN',
      'ERROR',
      'INFO',
      'INFO',
      'INFO',
      'INFO',
      'INFO',
      'INFO'
    ];

    const proxyAccessLog = {
      authority: 'productpage:9080',
      bytes_received: '0',
      bytes_sent: '5765',
      downstream_local: '10.244.0.15:9080',
      downstream_remote: '10.244.0.1:47832',
      duration: '23',
      forwarded_for: '-',
      method: 'GET',
      protocol: 'HTTP/1.1',
      request_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      requested_server: '-',
      response_flags: '-',
      route_name: 'default',
      status_code: '200',
      tcp_service_time: '-',
      timestamp: new Date((baseTime + 120) * 1000).toISOString(),
      upstream_cluster: 'inbound|9080||',
      upstream_failure_reason: '-',
      upstream_local: '127.0.0.6:46543',
      upstream_service: '10.244.0.15:9080',
      upstream_service_time: '22',
      uri_param: '-',
      uri_path: '/api/v1/products',
      user_agent: 'Mozilla/5.0 (compatible; istio-probe/1.0)'
    };

    const proxyAccessLog503 = {
      ...proxyAccessLog,
      status_code: '503',
      duration: '5001',
      response_flags: 'UF',
      upstream_failure_reason: 'connection_termination',
      bytes_sent: '91',
      uri_path: '/api/v1/ratings',
      request_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
    };

    const entries =
      logType === 'proxy'
        ? [
            ...[
              'GET /api/v1/products HTTP/1.1 200 5765 23ms',
              'GET /api/v1/reviews?product=42 HTTP/1.1 200 1234 12ms',
              'GET /healthz/ready HTTP/1.1 200 0 1ms',
              'GET /api/v1/details?isbn=0123456789 HTTP/1.1 200 890 8ms',
              'GET /api/v1/ratings HTTP/1.1 503 91 5001ms',
              'GET /api/v1/products HTTP/1.1 200 5780 19ms',
              'GET /healthz/ready HTTP/1.1 200 0 0ms',
              'POST /api/v1/reviews HTTP/1.1 201 234 45ms',
              'GET /api/v1/products?page=2 HTTP/1.1 200 5102 21ms',
              'GET /stats/prometheus HTTP/1.1 200 12456 3ms'
            ].map((msg, i) => ({
              message: `[${new Date((baseTime + i * 15) * 1000).toISOString()}] "${msg}"`,
              severity: msg.includes('503') ? 'ERROR' : 'INFO',
              timestamp: new Date((baseTime + i * 15) * 1000).toISOString(),
              timestampUnix: baseTime + i * 15,
              accessLog: i === 4 ? proxyAccessLog503 : i % 3 === 0 ? proxyAccessLog : undefined
            }))
          ]
        : appMessages.map((msg, i) => {
            const isJsonMsg = msg.startsWith('{');
            return {
              message: isJsonMsg ? msg : `[${new Date((baseTime + i * 15) * 1000).toISOString()}] ${msg}`,
              severity: severities[i],
              timestamp: new Date((baseTime + i * 15) * 1000).toISOString(),
              timestampUnix: baseTime + i * 15
            };
          });

    return HttpResponse.json({ entries, linesTruncated: false });
  }),

  http.get('*/api/grafana', () => {
    return HttpResponse.json({
      externalLinks: []
    });
  }),

  http.get('*/api/perses', () => {
    return HttpResponse.json({
      enabled: false,
      url: ''
    });
  }),

  // Stats metrics - returns percentile stats for trace comparison
  http.post('*/api/stats/metrics', async ({ request }) => {
    const body = (await request.json()) as {
      queries: Array<{
        direction: string;
        interval: string;
        target: { kind: string; name: string; namespace: string };
      }>;
    };
    const stats: Record<string, { isCompact: boolean; responseTimes: Array<{ name: string; value: number }> }> = {};

    // Generate stats for each query
    if (body.queries) {
      body.queries.forEach(query => {
        const { target, direction, interval } = query;
        // Key format: namespace:kind:name::direction:interval
        const key = `${target.namespace}:${target.kind}:${target.name}::${direction}:${interval}`;

        // Generate realistic percentile values (in milliseconds)
        const baseLatency = 20 + Math.random() * 30; // 20-50ms base
        stats[key] = {
          isCompact: false,
          responseTimes: [
            { name: 'avg', value: baseLatency },
            { name: '0.5', value: baseLatency * 0.8 },
            { name: '0.9', value: baseLatency * 1.5 },
            { name: '0.95', value: baseLatency * 2 },
            { name: '0.99', value: baseLatency * 3 }
          ]
        };
      });
    }

    return HttpResponse.json({ stats });
  })
];
