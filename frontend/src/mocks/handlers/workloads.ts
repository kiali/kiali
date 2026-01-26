import { http, HttpResponse } from 'msw';
import { InstanceType } from '../../types/Common';
import { Metric } from '../../types/Metrics';
import { getScenarioConfig, getItemHealthStatus } from '../scenarios';

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
        metrics: [
          {
            datapoints: generateDatapoints(10, 5),
            labels: { reporter, request_protocol: 'http', response_code: '200' },
            name: 'request_count'
          }
        ],
        chartType: 'area',
        xAxis: 'time'
      },
      {
        name: 'Request duration',
        unit: 'ms',
        spans: 3,
        metrics: [
          {
            datapoints: generateDatapoints(30, 10),
            labels: { reporter },
            name: 'request_duration_millis',
            stat: 'avg'
          }
        ],
        chartType: 'line',
        xAxis: 'time'
      },
      {
        name: 'Request size',
        unit: 'B',
        spans: 3,
        metrics: [
          {
            datapoints: generateDatapoints(360, 20),
            labels: { reporter },
            name: 'request_size',
            stat: 'avg'
          }
        ],
        chartType: 'area',
        xAxis: 'time'
      },
      {
        name: 'Response size',
        unit: 'B',
        spans: 3,
        metrics: [
          {
            datapoints: generateDatapoints(190, 10),
            labels: { reporter },
            name: 'response_size',
            stat: 'avg'
          }
        ],
        chartType: 'area',
        xAxis: 'time'
      },
      {
        name: 'Request throughput',
        unit: 'kbit/s',
        spans: 3,
        metrics: [
          {
            datapoints: generateDatapoints(900, 300),
            labels: { reporter },
            name: 'request_throughput'
          }
        ],
        chartType: 'area',
        xAxis: 'time'
      },
      {
        name: 'Response throughput',
        unit: 'bit/s',
        spans: 3,
        metrics: [
          {
            datapoints: generateDatapoints(450, 150),
            labels: { reporter },
            name: 'response_throughput'
          }
        ],
        chartType: 'area',
        xAxis: 'time'
      },
      {
        name: 'gRPC received',
        unit: 'msg/s',
        spans: 3,
        metrics: [
          {
            datapoints: generateDatapoints(5, 2),
            labels: { reporter },
            name: 'grpc_received'
          }
        ],
        chartType: 'area',
        xAxis: 'time'
      },
      {
        name: 'gRPC sent',
        unit: 'msg/s',
        spans: 3,
        metrics: [
          {
            datapoints: generateDatapoints(5, 2),
            labels: { reporter },
            name: 'grpc_sent'
          }
        ],
        chartType: 'area',
        xAxis: 'time'
      },
      {
        name: 'TCP opened',
        unit: 'conn/s',
        spans: 3,
        metrics: [
          {
            datapoints: generateDatapoints(0.3, 0.15),
            labels: { reporter },
            name: 'tcp_opened'
          }
        ],
        chartType: 'area',
        xAxis: 'time'
      },
      {
        name: 'TCP closed',
        unit: 'conn/s',
        spans: 3,
        metrics: [
          {
            datapoints: generateDatapoints(0.3, 0.15),
            labels: { reporter },
            name: 'tcp_closed'
          }
        ],
        chartType: 'area',
        xAxis: 'time'
      },
      {
        name: 'TCP received',
        unit: 'bit/s',
        spans: 3,
        metrics: [
          {
            datapoints: generateDatapoints(80, 30),
            labels: { reporter },
            name: 'tcp_received'
          }
        ],
        chartType: 'area',
        xAxis: 'time'
      },
      {
        name: 'TCP sent',
        unit: 'bit/s',
        spans: 3,
        metrics: [
          {
            datapoints: generateDatapoints(70, 25),
            labels: { reporter },
            name: 'tcp_sent'
          }
        ],
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

const createMockWorkloadListItem = (
  name: string,
  namespace: string,
  app: string,
  version: string
): MockWorkloadListItem => {
  const healthStatus = getItemHealthStatus(name, namespace);
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

  return {
    name,
    namespace,
    cluster: 'cluster-default',
    gvk: deploymentGVK,
    instanceType: InstanceType.Workload,
    istioSidecar: true,
    isAmbient: false,
    isGateway: false,
    isWaypoint: false,
    isZtunnel: false,
    istioReferences: [],
    labels: {
      app,
      version
    },
    appLabel: true,
    versionLabel: true,
    validations,
    health: {
      workloadStatus: {
        name,
        desiredReplicas: 1,
        currentReplicas: 1,
        availableReplicas: healthStatus === 'unhealthy' ? 0 : 1,
        syncedProxies: healthStatus === 'unhealthy' ? 0 : 1
      },
      requests: {
        inbound: { http: httpResponses },
        outbound: { http: httpResponses },
        healthAnnotations: {}
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

const createMockServiceListItem = (name: string, namespace: string): MockServiceListItem => {
  const healthStatus = getItemHealthStatus(name, namespace);
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
    cluster: 'cluster-default',
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

const createMockAppListItem = (name: string, namespace: string): MockAppListItem => {
  const healthStatus = getItemHealthStatus(name, namespace);
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
    cluster: 'cluster-default',
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
          desiredReplicas: 1,
          currentReplicas: 1,
          availableReplicas: healthStatus === 'unhealthy' ? 0 : 1,
          syncedProxies: healthStatus === 'unhealthy' ? 0 : 1
        }
      ]
    }
  };
};

// Generate workloads dynamically based on scenario - called per request
const getWorkloadsByNamespace = (): Record<string, MockWorkloadListItem[]> => ({
  bookinfo: [
    createMockWorkloadListItem('productpage-v1', 'bookinfo', 'productpage', 'v1'),
    createMockWorkloadListItem('details-v1', 'bookinfo', 'details', 'v1'),
    createMockWorkloadListItem('reviews-v1', 'bookinfo', 'reviews', 'v1'),
    createMockWorkloadListItem('reviews-v2', 'bookinfo', 'reviews', 'v2'),
    createMockWorkloadListItem('reviews-v3', 'bookinfo', 'reviews', 'v3'),
    createMockWorkloadListItem('ratings-v1', 'bookinfo', 'ratings', 'v1')
  ],
  'istio-system': [
    createMockWorkloadListItem('istiod', 'istio-system', 'istiod', 'default'),
    createMockWorkloadListItem('istio-ingressgateway', 'istio-system', 'istio-ingressgateway', 'default')
  ],
  'travel-agency': [
    createMockWorkloadListItem('travels-v1', 'travel-agency', 'travels', 'v1'),
    createMockWorkloadListItem('hotels-v1', 'travel-agency', 'hotels', 'v1'),
    createMockWorkloadListItem('cars-v1', 'travel-agency', 'cars', 'v1'),
    createMockWorkloadListItem('flights-v1', 'travel-agency', 'flights', 'v1')
  ],
  'travel-portal': [
    createMockWorkloadListItem('voyages-v1', 'travel-portal', 'voyages', 'v1'),
    createMockWorkloadListItem('viaggi-v1', 'travel-portal', 'viaggi', 'v1')
  ]
});

// Generate services dynamically based on scenario - called per request
const getServicesByNamespace = (): Record<string, MockServiceListItem[]> => ({
  bookinfo: [
    createMockServiceListItem('productpage', 'bookinfo'),
    createMockServiceListItem('details', 'bookinfo'),
    createMockServiceListItem('reviews', 'bookinfo'),
    createMockServiceListItem('ratings', 'bookinfo')
  ],
  'istio-system': [
    createMockServiceListItem('istiod', 'istio-system'),
    createMockServiceListItem('istio-ingressgateway', 'istio-system')
  ],
  'travel-agency': [
    createMockServiceListItem('travels', 'travel-agency'),
    createMockServiceListItem('hotels', 'travel-agency'),
    createMockServiceListItem('cars', 'travel-agency'),
    createMockServiceListItem('flights', 'travel-agency')
  ],
  'travel-portal': [
    createMockServiceListItem('voyages', 'travel-portal'),
    createMockServiceListItem('viaggi', 'travel-portal')
  ]
});

// Generate apps dynamically based on scenario - called per request
const getAppsByNamespace = (): Record<string, MockAppListItem[]> => ({
  bookinfo: [
    createMockAppListItem('productpage', 'bookinfo'),
    createMockAppListItem('details', 'bookinfo'),
    createMockAppListItem('reviews', 'bookinfo'),
    createMockAppListItem('ratings', 'bookinfo')
  ],
  'istio-system': [
    createMockAppListItem('istiod', 'istio-system'),
    createMockAppListItem('istio-ingressgateway', 'istio-system')
  ],
  'travel-agency': [
    createMockAppListItem('travels', 'travel-agency'),
    createMockAppListItem('hotels', 'travel-agency'),
    createMockAppListItem('cars', 'travel-agency'),
    createMockAppListItem('flights', 'travel-agency')
  ],
  'travel-portal': [createMockAppListItem('voyages', 'travel-portal'), createMockAppListItem('viaggi', 'travel-portal')]
});

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
  http.get('*/api/clusters/workloads', ({ request }) => {
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
  http.get('*/api/clusters/apps', ({ request }) => {
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

      return HttpResponse.json({
        ...found,
        createdAt: new Date().toISOString(),
        resourceVersion: '12345',
        type: 'Deployment',
        istioInjectionAnnotation: true,
        podCount: 1,
        annotations: {},
        healthAnnotations: {},
        additionalDetails: [],
        serviceAccountNames: [`${found.labels.app}-service-account`],
        pods: [
          {
            name: `${workload}-abc123`,
            labels: found.labels,
            createdAt: new Date().toISOString(),
            createdBy: [{ name: workload as string, kind: 'Deployment' }],
            istioContainers: [{ name: 'istio-proxy', image: 'docker.io/istio/proxyv2:1.20.0' }],
            istioInitContainers: [{ name: 'istio-init', image: 'docker.io/istio/proxyv2:1.20.0' }],
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
        runtimes: [],
        validations: workloadValidations,
        waypointWorkloads: []
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
  http.get('*/api/namespaces/:namespace/pods/:pod/logs', () => {
    return HttpResponse.json({
      entries: [
        {
          message: '[2024-01-20T12:00:00.000Z] Mock log entry 1',
          severity: 'INFO',
          timestamp: '2024-01-20T12:00:00.000Z'
        },
        {
          message: '[2024-01-20T12:00:01.000Z] Mock log entry 2',
          severity: 'INFO',
          timestamp: '2024-01-20T12:00:01.000Z'
        }
      ]
    });
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
