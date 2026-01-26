import { http, HttpResponse } from 'msw';
import { getScenarioConfig, getItemHealthStatus } from '../scenarios';

// Create health status based on scenario
const createHealthyStatus = (workloadName?: string, namespace?: string): Record<string, unknown> => {
  const healthStatus = workloadName ? getItemHealthStatus(workloadName, namespace) : 'healthy';
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
            desiredReplicas: 1,
            currentReplicas: 1,
            availableReplicas: healthStatus === 'unhealthy' ? 0 : 1,
            syncedProxies: healthStatus === 'unhealthy' ? 0 : 1
          }
        ]
      : []
  };
};

const createWorkloadHealthStatus = (workloadName: string, namespace?: string): Record<string, unknown> => {
  const healthStatus = getItemHealthStatus(workloadName, namespace);
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

  return {
    workloadStatus: {
      name: workloadName,
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
  };
};

// Generate health data dynamically based on scenario
const generateClustersHealth = (): Record<string, unknown> => ({
  namespaceAppHealth: {
    bookinfo: {
      productpage: createHealthyStatus('productpage-v1', 'bookinfo'),
      details: createHealthyStatus('details-v1', 'bookinfo'),
      reviews: createHealthyStatus('reviews-v1', 'bookinfo'),
      ratings: createHealthyStatus('ratings-v1', 'bookinfo')
    },
    'istio-system': {
      istiod: createHealthyStatus('istiod', 'istio-system'),
      'istio-ingressgateway': createHealthyStatus('istio-ingressgateway', 'istio-system')
    },
    'travel-agency': {
      travels: createHealthyStatus('travels-v1', 'travel-agency'),
      hotels: createHealthyStatus('hotels-v1', 'travel-agency'),
      cars: createHealthyStatus('cars-v1', 'travel-agency'),
      flights: createHealthyStatus('flights-v1', 'travel-agency')
    },
    'travel-portal': {
      voyages: createHealthyStatus('voyages-v1', 'travel-portal'),
      viaggi: createHealthyStatus('viaggi-v1', 'travel-portal')
    }
  },
  namespaceServiceHealth: {
    bookinfo: {
      productpage: createHealthyStatus(undefined, 'bookinfo'),
      details: createHealthyStatus(undefined, 'bookinfo'),
      reviews: createHealthyStatus(undefined, 'bookinfo'),
      ratings: createHealthyStatus(undefined, 'bookinfo')
    },
    'istio-system': {
      istiod: createHealthyStatus(undefined, 'istio-system'),
      'istio-ingressgateway': createHealthyStatus(undefined, 'istio-system')
    },
    'travel-agency': {
      travels: createHealthyStatus(undefined, 'travel-agency'),
      hotels: createHealthyStatus(undefined, 'travel-agency'),
      cars: createHealthyStatus(undefined, 'travel-agency'),
      flights: createHealthyStatus(undefined, 'travel-agency')
    },
    'travel-portal': {
      voyages: createHealthyStatus(undefined, 'travel-portal'),
      viaggi: createHealthyStatus(undefined, 'travel-portal')
    }
  },
  namespaceWorkloadHealth: {
    bookinfo: {
      'productpage-v1': createWorkloadHealthStatus('productpage-v1', 'bookinfo'),
      'details-v1': createWorkloadHealthStatus('details-v1', 'bookinfo'),
      'reviews-v1': createWorkloadHealthStatus('reviews-v1', 'bookinfo'),
      'reviews-v2': createWorkloadHealthStatus('reviews-v2', 'bookinfo'),
      'reviews-v3': createWorkloadHealthStatus('reviews-v3', 'bookinfo'),
      'ratings-v1': createWorkloadHealthStatus('ratings-v1', 'bookinfo')
    },
    'istio-system': {
      istiod: createWorkloadHealthStatus('istiod', 'istio-system'),
      'istio-ingressgateway': createWorkloadHealthStatus('istio-ingressgateway', 'istio-system')
    },
    'travel-agency': {
      'travels-v1': createWorkloadHealthStatus('travels-v1', 'travel-agency'),
      'hotels-v1': createWorkloadHealthStatus('hotels-v1', 'travel-agency'),
      'cars-v1': createWorkloadHealthStatus('cars-v1', 'travel-agency'),
      'flights-v1': createWorkloadHealthStatus('flights-v1', 'travel-agency')
    },
    'travel-portal': {
      'voyages-v1': createWorkloadHealthStatus('voyages-v1', 'travel-portal'),
      'viaggi-v1': createWorkloadHealthStatus('viaggi-v1', 'travel-portal')
    }
  }
});

// Get health for specific namespaces
const getHealthForNamespaces = (namespaces: string, type: 'app' | 'service' | 'workload'): Record<string, unknown> => {
  const nsList = namespaces.split(',').map(ns => ns.trim());
  const clustersHealth = generateClustersHealth() as {
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

    if (type === 'app') {
      return HttpResponse.json({
        namespaceAppHealth: getHealthForNamespaces(namespaces, 'app')
      });
    } else if (type === 'service') {
      return HttpResponse.json({
        namespaceServiceHealth: getHealthForNamespaces(namespaces, 'service')
      });
    } else if (type === 'workload') {
      return HttpResponse.json({
        namespaceWorkloadHealth: getHealthForNamespaces(namespaces, 'workload')
      });
    }

    // Return all health types if no type specified
    return HttpResponse.json(generateClustersHealth());
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
