import { http, HttpResponse } from 'msw';
import { InstanceType } from '../../types/Common';
import { Metric } from '../../types/Metrics';

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
const generateMockMetrics = (direction: string): unknown => {
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
const generateMockDashboard = (entityType: string, direction: string): unknown => {
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

// Mock GVK for Deployment
const deploymentGVK = {
  Group: 'apps',
  Kind: 'Deployment',
  Version: 'v1'
};

const createMockWorkloadListItem = (name: string, namespace: string, app: string, version: string): unknown => ({
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
  health: {
    workloadStatus: {
      name,
      desiredReplicas: 1,
      currentReplicas: 1,
      availableReplicas: 1,
      syncedProxies: 1
    },
    requests: {
      inbound: { http: { '200': 100 } },
      outbound: { http: { '200': 100 } },
      healthAnnotations: {}
    }
  }
});

// GVK for Service
const serviceGVK = {
  Group: '',
  Kind: 'Service',
  Version: 'v1'
};

const createMockServiceListItem = (name: string, namespace: string): unknown => ({
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
      inbound: { http: { '200': 100 } },
      outbound: { http: { '200': 100 } },
      healthAnnotations: {}
    }
  },
  validation: {
    name: name,
    objectGVK: serviceGVK,
    valid: true,
    checks: []
  }
});

const createMockAppListItem = (name: string, namespace: string): unknown => ({
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
      inbound: { http: { '200': 100 } },
      outbound: { http: { '200': 100 } },
      healthAnnotations: {}
    },
    workloadStatuses: [
      {
        name: `${name}-v1`,
        desiredReplicas: 1,
        currentReplicas: 1,
        availableReplicas: 1,
        syncedProxies: 1
      }
    ]
  }
});

// Create workloads for bookinfo namespace
const bookinfoWorkloads = [
  createMockWorkloadListItem('productpage-v1', 'bookinfo', 'productpage', 'v1'),
  createMockWorkloadListItem('details-v1', 'bookinfo', 'details', 'v1'),
  createMockWorkloadListItem('reviews-v1', 'bookinfo', 'reviews', 'v1'),
  createMockWorkloadListItem('reviews-v2', 'bookinfo', 'reviews', 'v2'),
  createMockWorkloadListItem('reviews-v3', 'bookinfo', 'reviews', 'v3'),
  createMockWorkloadListItem('ratings-v1', 'bookinfo', 'ratings', 'v1')
];

// Create workloads for istio-system namespace
const istioSystemWorkloads = [
  createMockWorkloadListItem('istiod', 'istio-system', 'istiod', 'default'),
  createMockWorkloadListItem('istio-ingressgateway', 'istio-system', 'istio-ingressgateway', 'default')
];

// Create workloads for travel-agency namespace
const travelAgencyWorkloads = [
  createMockWorkloadListItem('travels-v1', 'travel-agency', 'travels', 'v1'),
  createMockWorkloadListItem('hotels-v1', 'travel-agency', 'hotels', 'v1'),
  createMockWorkloadListItem('cars-v1', 'travel-agency', 'cars', 'v1'),
  createMockWorkloadListItem('flights-v1', 'travel-agency', 'flights', 'v1')
];

// Create workloads for travel-portal namespace
const travelPortalWorkloads = [
  createMockWorkloadListItem('voyages-v1', 'travel-portal', 'voyages', 'v1'),
  createMockWorkloadListItem('viaggi-v1', 'travel-portal', 'viaggi', 'v1')
];

// All workloads map by namespace
const workloadsByNamespace: Record<string, typeof bookinfoWorkloads> = {
  bookinfo: bookinfoWorkloads,
  'istio-system': istioSystemWorkloads,
  'travel-agency': travelAgencyWorkloads,
  'travel-portal': travelPortalWorkloads
};

// Create services for bookinfo namespace
const bookinfoServices = [
  createMockServiceListItem('productpage', 'bookinfo'),
  createMockServiceListItem('details', 'bookinfo'),
  createMockServiceListItem('reviews', 'bookinfo'),
  createMockServiceListItem('ratings', 'bookinfo')
];

const istioSystemServices = [
  createMockServiceListItem('istiod', 'istio-system'),
  createMockServiceListItem('istio-ingressgateway', 'istio-system')
];

const travelAgencyServices = [
  createMockServiceListItem('travels', 'travel-agency'),
  createMockServiceListItem('hotels', 'travel-agency'),
  createMockServiceListItem('cars', 'travel-agency'),
  createMockServiceListItem('flights', 'travel-agency')
];

const travelPortalServices = [
  createMockServiceListItem('voyages', 'travel-portal'),
  createMockServiceListItem('viaggi', 'travel-portal')
];

const servicesByNamespace: Record<string, typeof bookinfoServices> = {
  bookinfo: bookinfoServices,
  'istio-system': istioSystemServices,
  'travel-agency': travelAgencyServices,
  'travel-portal': travelPortalServices
};

// Create apps for bookinfo namespace
const bookinfoApps = [
  createMockAppListItem('productpage', 'bookinfo'),
  createMockAppListItem('details', 'bookinfo'),
  createMockAppListItem('reviews', 'bookinfo'),
  createMockAppListItem('ratings', 'bookinfo')
];

const istioSystemApps = [
  createMockAppListItem('istiod', 'istio-system'),
  createMockAppListItem('istio-ingressgateway', 'istio-system')
];

const travelAgencyApps = [
  createMockAppListItem('travels', 'travel-agency'),
  createMockAppListItem('hotels', 'travel-agency'),
  createMockAppListItem('cars', 'travel-agency'),
  createMockAppListItem('flights', 'travel-agency')
];

const travelPortalApps = [
  createMockAppListItem('voyages', 'travel-portal'),
  createMockAppListItem('viaggi', 'travel-portal')
];

const appsByNamespace: Record<string, typeof bookinfoApps> = {
  bookinfo: bookinfoApps,
  'istio-system': istioSystemApps,
  'travel-agency': travelAgencyApps,
  'travel-portal': travelPortalApps
};

// Helper to get workloads for requested namespaces
const getWorkloadsForNamespaces = (namespaces: string): typeof bookinfoWorkloads => {
  const nsList = namespaces.split(',').map(ns => ns.trim());
  return nsList.flatMap(ns => workloadsByNamespace[ns] || []);
};

const getServicesForNamespaces = (namespaces: string): typeof bookinfoServices => {
  const nsList = namespaces.split(',').map(ns => ns.trim());
  return nsList.flatMap(ns => servicesByNamespace[ns] || []);
};

const getAppsForNamespaces = (namespaces: string): typeof bookinfoApps => {
  const nsList = namespaces.split(',').map(ns => ns.trim());
  return nsList.flatMap(ns => appsByNamespace[ns] || []);
};

export const workloadHandlers = [
  // Clusters workloads - main endpoint for workload list
  http.get('*/api/clusters/workloads', ({ request }) => {
    const url = new URL(request.url);
    const namespaces = url.searchParams.get('namespaces') || 'bookinfo';
    const workloads = getWorkloadsForNamespaces(namespaces);

    return HttpResponse.json({
      cluster: 'cluster-default',
      workloads,
      validations: {}
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
    const workloads = workloadsByNamespace[namespace as string] || [];

    return HttpResponse.json({
      cluster: 'cluster-default',
      namespace,
      workloads,
      validations: {}
    });
  }),

  // Workload detail
  http.get('*/api/namespaces/:namespace/workloads/:workload', ({ params }) => {
    const { workload, namespace } = params;
    const nsWorkloads = workloadsByNamespace[namespace as string] || bookinfoWorkloads;
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
        valid: true,
        checks: []
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
    const nsServices = servicesByNamespace[namespace as string] || bookinfoServices;
    const found = nsServices.find(s => s.name === service);

    if (found) {
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
    const nsApps = appsByNamespace[namespace as string] || bookinfoApps;
    const found = nsApps.find(a => a.name === app);

    if (found) {
      const nsWorkloads = workloadsByNamespace[namespace as string] || [];
      const relatedWorkloads = nsWorkloads.filter(w => w.labels.app === app);

      return HttpResponse.json({
        ...found,
        namespace: { name: namespace },
        workloads: relatedWorkloads,
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
