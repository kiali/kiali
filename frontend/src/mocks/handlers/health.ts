import { http, HttpResponse } from 'msw';
import { getScenarioConfig, getItemHealthStatus, getAllNamespaces } from '../scenarios';

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

// Create health status based on scenario
const createHealthyStatus = (workloadName?: string, namespace?: string, cluster?: string): Record<string, unknown> => {
  const healthStatus = workloadName ? getItemHealthStatus(workloadName, namespace, cluster) : 'healthy';
  const errorRate = getScenarioConfig().errorRate;

  // Calculate HTTP response distribution based on health
  let http200 = 100;
  let http500 = 0;
  let http503 = 0;

  if (healthStatus === 'unhealthy') {
    http200 = 100 - errorRate - 10;
    http500 = errorRate;
    http503 = 10;
  } else if (healthStatus === 'degraded') {
    http200 = 100 - Math.floor(errorRate / 2) - 5;
    http500 = Math.floor(errorRate / 2);
    http503 = 5;
  }

  const httpResponses: Record<string, number> = { '200': http200 };
  if (http500 > 0) httpResponses['500'] = http500;
  if (http503 > 0) httpResponses['503'] = http503;

  // Not ready status means workload is scaled down (desiredReplicas = 0)
  const isNotReady = healthStatus === 'notready';
  const isUnhealthy = healthStatus === 'unhealthy';

  return {
    requests: {
      inbound: { http: httpResponses },
      outbound: { http: httpResponses },
      healthAnnotations: {}
    },
    workloadStatuses: workloadName
      ? [
          {
            name: workloadName,
            desiredReplicas: isNotReady ? 0 : 1,
            currentReplicas: isNotReady ? 0 : 1,
            availableReplicas: isNotReady || isUnhealthy ? 0 : 1,
            syncedProxies: isNotReady || isUnhealthy ? 0 : 1
          }
        ]
      : [],
    // Backend-calculated status - this is what Health.getStatus() uses
    status: {
      status: toBackendStatus(healthStatus),
      errorRatio: healthStatus === 'unhealthy' ? errorRate : healthStatus === 'degraded' ? errorRate / 2 : 0
    }
  };
};

const createWorkloadHealthStatus = (
  workloadName: string,
  namespace?: string,
  cluster?: string
): Record<string, unknown> => {
  const healthStatus = getItemHealthStatus(workloadName, namespace, cluster);
  const errorRate = getScenarioConfig().errorRate;

  let http200 = 100;
  let http500 = 0;
  let http503 = 0;

  if (healthStatus === 'unhealthy') {
    http200 = 100 - errorRate - 10;
    http500 = errorRate;
    http503 = 10;
  } else if (healthStatus === 'degraded') {
    http200 = 100 - Math.floor(errorRate / 2) - 5;
    http500 = Math.floor(errorRate / 2);
    http503 = 5;
  }

  const httpResponses: Record<string, number> = { '200': http200 };
  if (http500 > 0) httpResponses['500'] = http500;
  if (http503 > 0) httpResponses['503'] = http503;

  // Not ready status means workload is scaled down (desiredReplicas = 0)
  const isNotReady = healthStatus === 'notready';
  const isUnhealthy = healthStatus === 'unhealthy';

  return {
    workloadStatus: {
      name: workloadName,
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
  };
};

// App/Service/Workload definitions per namespace
// Note: empty-ns-* namespaces intentionally have no definitions to show as NA/unknown health
const appDefinitions: Record<string, string[]> = {
  alpha: ['alpha-api', 'alpha-worker'],
  beta: ['beta-api', 'beta-db'],
  bookinfo: ['productpage', 'details', 'reviews', 'ratings'],
  default: ['httpbin', 'sleep'],
  delta: ['delta-api', 'delta-worker'],
  epsilon: ['epsilon-api', 'epsilon-db'],
  gamma: ['gamma-frontend', 'gamma-backend'],
  // idle-ns-* namespaces have workloads scaled to 0 (not ready status)
  'idle-ns-1': ['idle-api-1', 'idle-worker-1'],
  'idle-ns-2': ['idle-api-2', 'idle-worker-2'],
  'idle-ns-3': ['idle-api-3', 'idle-worker-3'],
  'idle-ns-4': ['idle-api-4', 'idle-worker-4'],
  'istio-system': ['istiod', 'istio-ingressgateway'],
  kappa: ['kappa-api', 'kappa-worker'],
  lambda: ['lambda-api', 'lambda-db'],
  mu: ['mu-api', 'mu-cache'],
  nu: ['nu-api', 'nu-worker'],
  'travel-agency': ['travels', 'hotels', 'cars', 'flights'],
  'travel-control': ['control', 'mysqldb'],
  'travel-portal': ['voyages', 'viaggi'],
  zeta: ['zeta-api', 'zeta-cache']
};

// Note: empty-ns-* namespaces intentionally have no definitions to show as NA/unknown health
const workloadDefinitions: Record<string, Array<{ app: string; name: string }>> = {
  alpha: [
    { name: 'alpha-api-v1', app: 'alpha-api' },
    { name: 'alpha-worker-v1', app: 'alpha-worker' }
  ],
  beta: [
    { name: 'beta-api-v1', app: 'beta-api' },
    { name: 'beta-db-v1', app: 'beta-db' }
  ],
  bookinfo: [
    { name: 'productpage-v1', app: 'productpage' },
    { name: 'details-v1', app: 'details' },
    { name: 'reviews-v1', app: 'reviews' },
    { name: 'reviews-v2', app: 'reviews' },
    { name: 'reviews-v3', app: 'reviews' },
    { name: 'ratings-v1', app: 'ratings' }
  ],
  default: [
    { name: 'httpbin-v1', app: 'httpbin' },
    { name: 'sleep-v1', app: 'sleep' }
  ],
  delta: [
    { name: 'delta-api-v1', app: 'delta-api' },
    { name: 'delta-worker-v1', app: 'delta-worker' }
  ],
  epsilon: [
    { name: 'epsilon-api-v1', app: 'epsilon-api' },
    { name: 'epsilon-db-v1', app: 'epsilon-db' }
  ],
  gamma: [
    { name: 'gamma-frontend-v1', app: 'gamma-frontend' },
    { name: 'gamma-backend-v1', app: 'gamma-backend' }
  ],
  // idle-ns-* namespaces have workloads scaled to 0 (not ready status)
  'idle-ns-1': [
    { name: 'idle-api-1-v1', app: 'idle-api-1' },
    { name: 'idle-worker-1-v1', app: 'idle-worker-1' }
  ],
  'idle-ns-2': [
    { name: 'idle-api-2-v1', app: 'idle-api-2' },
    { name: 'idle-worker-2-v1', app: 'idle-worker-2' }
  ],
  'idle-ns-3': [
    { name: 'idle-api-3-v1', app: 'idle-api-3' },
    { name: 'idle-worker-3-v1', app: 'idle-worker-3' }
  ],
  'idle-ns-4': [
    { name: 'idle-api-4-v1', app: 'idle-api-4' },
    { name: 'idle-worker-4-v1', app: 'idle-worker-4' }
  ],
  'istio-system': [
    { name: 'istiod', app: 'istiod' },
    { name: 'istio-ingressgateway', app: 'istio-ingressgateway' }
  ],
  kappa: [
    { name: 'kappa-api-v1', app: 'kappa-api' },
    { name: 'kappa-worker-v1', app: 'kappa-worker' }
  ],
  lambda: [
    { name: 'lambda-api-v1', app: 'lambda-api' },
    { name: 'lambda-db-v1', app: 'lambda-db' }
  ],
  mu: [
    { name: 'mu-api-v1', app: 'mu-api' },
    { name: 'mu-cache-v1', app: 'mu-cache' }
  ],
  nu: [
    { name: 'nu-api-v1', app: 'nu-api' },
    { name: 'nu-worker-v1', app: 'nu-worker' }
  ],
  'travel-agency': [
    { name: 'travels-v1', app: 'travels' },
    { name: 'hotels-v1', app: 'hotels' },
    { name: 'cars-v1', app: 'cars' },
    { name: 'flights-v1', app: 'flights' }
  ],
  'travel-control': [
    { name: 'control-v1', app: 'control' },
    { name: 'mysqldb-v1', app: 'mysqldb' }
  ],
  'travel-portal': [
    { name: 'voyages-v1', app: 'voyages' },
    { name: 'viaggi-v1', app: 'viaggi' }
  ],
  zeta: [
    { name: 'zeta-api-v1', app: 'zeta-api' },
    { name: 'zeta-cache-v1', app: 'zeta-cache' }
  ]
};

// Generate health data dynamically based on scenario
// When clusterName is provided, only returns health for namespaces in that cluster
// Keys are namespace names (e.g., "bookinfo") - the API returns health keyed by namespace name
const generateClustersHealth = (clusterName?: string): Record<string, unknown> => {
  const allNamespaces = getAllNamespaces();
  const namespaceAppHealth: Record<string, Record<string, unknown>> = {};
  const namespaceServiceHealth: Record<string, Record<string, unknown>> = {};
  const namespaceWorkloadHealth: Record<string, Record<string, unknown>> = {};

  // Filter by cluster if specified
  const filteredNamespaces = clusterName ? allNamespaces.filter(ns => ns.cluster === clusterName) : allNamespaces;

  filteredNamespaces.forEach(ns => {
    // Use just namespace name as key - the API returns health keyed by namespace name
    const key = ns.name;

    // Generate app health
    const apps = appDefinitions[ns.name] || [];
    namespaceAppHealth[key] = {};
    apps.forEach(appName => {
      namespaceAppHealth[key][appName] = createHealthyStatus(`${appName}-v1`, ns.name, ns.cluster);
    });

    // Generate service health
    namespaceServiceHealth[key] = {};
    apps.forEach(appName => {
      namespaceServiceHealth[key][appName] = createHealthyStatus(undefined, ns.name, ns.cluster);
    });

    // Generate workload health
    const workloads = workloadDefinitions[ns.name] || [];
    namespaceWorkloadHealth[key] = {};
    workloads.forEach(wl => {
      namespaceWorkloadHealth[key][wl.name] = createWorkloadHealthStatus(wl.name, ns.name, ns.cluster);
    });
  });

  return {
    namespaceAppHealth,
    namespaceServiceHealth,
    namespaceWorkloadHealth
  };
};

// Get health for specific namespaces, optionally filtered by cluster
// Keys in healthMap are namespace names (e.g., "bookinfo")
const getHealthForNamespaces = (
  namespaces: string,
  type: 'app' | 'service' | 'workload',
  clusterName?: string
): Record<string, unknown> => {
  const nsList = namespaces.split(',').map(ns => ns.trim());
  const clustersHealth = generateClustersHealth(clusterName) as {
    namespaceAppHealth: Record<string, Record<string, unknown>>;
    namespaceServiceHealth: Record<string, Record<string, unknown>>;
    namespaceWorkloadHealth: Record<string, Record<string, unknown>>;
  };
  const healthMap = {
    app: clustersHealth.namespaceAppHealth,
    service: clustersHealth.namespaceServiceHealth,
    workload: clustersHealth.namespaceWorkloadHealth
  }[type];

  const result: Record<string, Record<string, unknown>> = {};

  // For each requested namespace, find matching entry in the health map
  nsList.forEach(ns => {
    if (healthMap[ns]) {
      result[ns] = healthMap[ns];
    }
  });

  return result;
};

export const healthHandlers = [
  // Clusters health - with query params support
  http.get('*/api/clusters/health', ({ request }) => {
    const url = new URL(request.url);
    const namespaces = url.searchParams.get('namespaces') || 'bookinfo';
    const type = url.searchParams.get('type') as 'app' | 'service' | 'workload' | null;
    const clusterName = url.searchParams.get('clusterName') || undefined;

    if (type === 'app') {
      return HttpResponse.json({
        namespaceAppHealth: getHealthForNamespaces(namespaces, 'app', clusterName)
      });
    } else if (type === 'service') {
      return HttpResponse.json({
        namespaceServiceHealth: getHealthForNamespaces(namespaces, 'service', clusterName)
      });
    } else if (type === 'workload') {
      return HttpResponse.json({
        namespaceWorkloadHealth: getHealthForNamespaces(namespaces, 'workload', clusterName)
      });
    }

    // Return all health types if no type specified
    return HttpResponse.json(generateClustersHealth(clusterName));
  }),

  // App health
  http.get('*/api/namespaces/:namespace/apps/:app/health', ({ params }) => {
    const { namespace, app } = params;
    return HttpResponse.json(createHealthyStatus(`${app}-v1`, namespace as string));
  }),

  // Service health
  http.get('*/api/namespaces/:namespace/services/:service/health', ({ params }) => {
    const { namespace } = params;
    return HttpResponse.json(createHealthyStatus(undefined, namespace as string));
  }),

  // Workload health
  http.get('*/api/namespaces/:namespace/workloads/:workload/health', ({ params }) => {
    const { namespace, workload } = params;
    return HttpResponse.json(createWorkloadHealthStatus(workload as string, namespace as string));
  }),

  // TLS endpoints
  http.get('*/api/mesh/tls', () => {
    return HttpResponse.json({
      status: 'ENABLED',
      autoMTLSEnabled: true,
      minTLS: 'N/A'
    });
  }),

  http.get('*/api/namespaces/:namespace/tls', () => {
    return HttpResponse.json({
      status: 'ENABLED',
      autoMTLSEnabled: true,
      minTLS: 'N/A'
    });
  }),

  http.get('*/api/clusters/tls', () => {
    return HttpResponse.json([
      {
        namespace: 'bookinfo',
        status: 'ENABLED',
        autoMTLSEnabled: true,
        minTLS: 'N/A'
      }
    ]);
  }),

  // Validations
  http.get('*/api/namespaces/:namespace/validations', () => {
    return HttpResponse.json({});
  }),

  http.get('*/api/clusters/validations', () => {
    return HttpResponse.json([{}]);
  }),

  // Outbound traffic policy mode
  http.get('*/api/mesh/outbound_traffic_policy/mode', () => {
    return HttpResponse.json({
      mode: 'ALLOW_ANY'
    });
  }),

  // Istiod resource thresholds
  http.get('*/api/istiod/resource_thresholds', () => {
    return HttpResponse.json({
      memory: 1073741824, // 1GB
      cpu: 1000 // 1 core
    });
  }),

  // Certs info
  http.get('*/api/istio/certs', () => {
    return HttpResponse.json([]);
  }),

  // Control plane metrics (for istiod)
  // Returns IstioMetricsMap format with pilot_proxy_convergence_time, container_cpu, container_memory, etc.
  http.get('*/api/namespaces/:namespace/controlplanes/:controlPlane/metrics', ({ params }) => {
    const { namespace, controlPlane } = params;
    const now = Date.now() / 1000;

    // Generate datapoints in Metric format: [timestamp, value][]
    const generateDatapoints = (baseValue: number, variance: number): Array<[number, number]> => {
      const datapoints: Array<[number, number]> = [];
      for (let i = 60; i >= 0; i--) {
        const timestamp = now - i * 60;
        const value = baseValue + (Math.random() - 0.5) * variance;
        datapoints.push([timestamp, Math.max(0, value)]);
      }
      return datapoints;
    };

    const createMetric = (name: string, baseValue: number, variance: number): Record<string, unknown>[] => [
      {
        datapoints: generateDatapoints(baseValue, variance),
        labels: {
          container: String(controlPlane),
          namespace: String(namespace),
          pod: `${controlPlane}-abc123`
        },
        name
      }
    ];

    return HttpResponse.json({
      pilot_proxy_convergence_time: createMetric('pilot_proxy_convergence_time', 0.5, 0.2), // 500ms avg
      container_cpu_usage_seconds_total: createMetric('container_cpu_usage_seconds_total', 0.02, 0.01), // 2% CPU
      container_memory_working_set_bytes: createMetric('container_memory_working_set_bytes', 80, 10), // 80MB
      process_cpu_seconds_total: createMetric('process_cpu_seconds_total', 0.015, 0.005), // 1.5% process CPU
      process_resident_memory_bytes: createMetric('process_resident_memory_bytes', 70, 8) // 70MB process memory
    });
  }),

  // Resource usage metrics (for mesh components like kiali, istiod, grafana, prometheus)
  // Returns Metric[] format: { datapoints: [timestamp, value][], labels: {}, name: string }
  http.get('*/api/namespaces/:namespace/:component/usage_metrics', ({ params }) => {
    const { namespace, component } = params;
    const now = Date.now() / 1000;

    // Generate datapoints in Metric format: [timestamp, value][]
    const generateDatapoints = (baseValue: number, variance: number): Array<[number, number]> => {
      const datapoints: Array<[number, number]> = [];
      for (let i = 60; i >= 0; i--) {
        const timestamp = now - i * 60;
        const value = baseValue + (Math.random() - 0.5) * variance;
        datapoints.push([timestamp, value]);
      }
      return datapoints;
    };

    // Different base values depending on component
    // CPU is in cores (0.01 = 1% of one core)
    // Memory is in MB
    let cpuBase = 0.005; // 0.5%
    let memoryBase = 30; // 30MB

    if (component === 'istiod') {
      cpuBase = 0.02; // 2%
      memoryBase = 80; // 80MB
    } else if (component === 'kiali') {
      cpuBase = 0.01; // 1%
      memoryBase = 50; // 50MB
    } else if (component === 'prometheus' || component === 'Prometheus') {
      cpuBase = 0.015; // 1.5%
      memoryBase = 120; // 120MB
    } else if (component === 'grafana' || component === 'Grafana') {
      cpuBase = 0.005; // 0.5%
      memoryBase = 40; // 40MB
    }

    // Return Metric[] format expected by ResourceUsageMetricsMap
    return HttpResponse.json({
      cpu_usage: [
        {
          datapoints: generateDatapoints(cpuBase, cpuBase * 0.2),
          labels: {
            container: String(component),
            namespace: String(namespace),
            pod: `${component}-abc123`
          },
          name: 'container_cpu_usage_seconds_total'
        }
      ],
      memory_usage: [
        {
          datapoints: generateDatapoints(memoryBase, memoryBase * 0.1),
          labels: {
            container: String(component),
            namespace: String(namespace),
            pod: `${component}-abc123`
          },
          name: 'container_memory_working_set_bytes'
        }
      ]
    });
  })
];
