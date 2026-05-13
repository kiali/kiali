import { InstanceType } from '../../types/Common';
import { Metric } from '../../types/Metrics';
import { getItemHealthStatus, getScenarioConfig } from '../scenarios';

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

export const generateMockMetrics = (direction: string): Record<string, unknown> => {
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

export const generateMockDashboard = (entityType: string, direction: string): Record<string, unknown> => {
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

export interface MockWorkloadListItem {
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

export interface MockServiceListItem {
  cluster: string;
  health: Record<string, unknown>;
  instanceType: InstanceType;
  isAmbient: boolean;
  isWaypoint: boolean;
  isZtunnel: boolean;
  istioReferences: unknown[];
  istioSidecar: boolean;
  kialiWizard: string;
  labels: Record<string, string>;
  name: string;
  namespace: string;
  ports: Record<string, number>;
  serviceRegistry: string;
  validation: Record<string, unknown>;
}

export interface MockAppListItem {
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

export const deploymentGVK = {
  Group: 'apps',
  Kind: 'Deployment',
  Version: 'v1'
};

export const serviceGVK = {
  Group: '',
  Kind: 'Service',
  Version: 'v1'
};

export const toBackendStatus = (healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'notready'): string => {
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

export const createMockWorkloadListItem = (
  name: string,
  namespace: string,
  app: string,
  version: string,
  cluster = 'cluster-default'
): MockWorkloadListItem => {
  const healthStatus = getItemHealthStatus(name, namespace, cluster);
  const errorRate = getScenarioConfig().errorRate;

  let httpResponses: Record<string, number> = { '200': 100 };
  if (healthStatus === 'unhealthy') {
    httpResponses = { '200': 100 - errorRate - 10, '500': errorRate, '503': 10 };
  } else if (healthStatus === 'degraded') {
    httpResponses = { '200': 100 - Math.floor(errorRate / 2) - 5, '500': Math.floor(errorRate / 2), '503': 5 };
  }

  let validations: MockWorkloadListItem['validations'] = undefined;
  const baseName = name.replace(/-v\d+$/, '');

  if (healthStatus === 'unhealthy' || baseName === 'reviews') {
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
      status: {
        status: toBackendStatus(healthStatus),
        errorRatio: healthStatus === 'unhealthy' ? errorRate : healthStatus === 'degraded' ? errorRate / 2 : 0
      }
    }
  };
};

export const createMockServiceListItem = (
  name: string,
  namespace: string,
  cluster = 'cluster-default',
  serviceRegistry = 'Kubernetes'
): MockServiceListItem => {
  const healthStatus = getItemHealthStatus(name, namespace, cluster);
  const errorRate = getScenarioConfig().errorRate;
  const isExternal = serviceRegistry === 'External';

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
    istioSidecar: !isExternal,
    isAmbient: false,
    isWaypoint: false,
    isZtunnel: false,
    istioReferences: [],
    kialiWizard: '',
    serviceRegistry,
    labels: isExternal ? {} : { app: name },
    ports: isExternal ? { https: 443 } : { http: 9080 },
    health: {
      requests: {
        inbound: { http: httpResponses },
        outbound: { http: httpResponses },
        healthAnnotations: {}
      },
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

export const createMockAppListItem = (
  name: string,
  namespace: string,
  cluster = 'cluster-default'
): MockAppListItem => {
  const healthStatus = getItemHealthStatus(name, namespace, cluster);
  const errorRate = getScenarioConfig().errorRate;

  let httpResponses: Record<string, number> = { '200': 100 };
  if (healthStatus === 'unhealthy') {
    httpResponses = { '200': 100 - errorRate - 10, '500': errorRate, '503': 10 };
  } else if (healthStatus === 'degraded') {
    httpResponses = { '200': 100 - Math.floor(errorRate / 2) - 5, '500': Math.floor(errorRate / 2), '503': 5 };
  }

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
      status: {
        status: toBackendStatus(healthStatus),
        errorRatio: healthStatus === 'unhealthy' ? errorRate : healthStatus === 'degraded' ? errorRate / 2 : 0
      }
    }
  };
};

export const workloadDefinitions: Record<string, Array<{ app: string; name: string; version: string }>> = {
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

export const serviceDefinitions: Record<string, string[]> = {
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

export const externalServiceDefinitions: Record<string, string[]> = {
  bookinfo: ['googleapis.com', 'aws.amazon.com'],
  'travel-agency': ['api.openweathermap.org', 'maps.googleapis.com']
};

export const appDefinitions = serviceDefinitions;

export const getAllWorkloads = (): MockWorkloadListItem[] => {
  const scenarioConfig = getScenarioConfig();
  const workloads: MockWorkloadListItem[] = [];

  scenarioConfig.clusters.forEach(cluster => {
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

export const getWorkloadsByNamespace = (): Record<string, MockWorkloadListItem[]> => {
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

export const getAllServices = (): MockServiceListItem[] => {
  const scenarioConfig = getScenarioConfig();
  const services: MockServiceListItem[] = [];

  scenarioConfig.clusters.forEach(cluster => {
    if (!cluster.accessible) return;

    cluster.namespaces.forEach(namespace => {
      const definitions = serviceDefinitions[namespace] || [];
      definitions.forEach(name => {
        services.push(createMockServiceListItem(name, namespace, cluster.name));
      });

      const externalDefs = externalServiceDefinitions[namespace] || [];
      externalDefs.forEach(name => {
        services.push(createMockServiceListItem(name, namespace, cluster.name, 'External'));
      });
    });
  });

  return services;
};

export const getServicesByNamespace = (): Record<string, MockServiceListItem[]> => {
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

export const getAllApps = (): MockAppListItem[] => {
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

export const getAppsByNamespace = (): Record<string, MockAppListItem[]> => {
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

export const getWorkloadsForNamespaces = (namespaces: string): MockWorkloadListItem[] => {
  const nsList = namespaces.split(',').map(ns => ns.trim());
  const workloadsByNamespace = getWorkloadsByNamespace();
  return nsList.flatMap(ns => workloadsByNamespace[ns] || []);
};

export const getServicesForNamespaces = (namespaces: string): MockServiceListItem[] => {
  const nsList = namespaces.split(',').map(ns => ns.trim());
  const servicesByNamespace = getServicesByNamespace();
  return nsList.flatMap(ns => servicesByNamespace[ns] || []);
};

export const getAppsForNamespaces = (namespaces: string): MockAppListItem[] => {
  const nsList = namespaces.split(',').map(ns => ns.trim());
  const appsByNamespace = getAppsByNamespace();
  return nsList.flatMap(ns => appsByNamespace[ns] || []);
};
