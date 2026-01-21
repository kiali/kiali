// Single cluster traffic graph (sidecar-based bookinfo topology)
import { createAppHealthData, createServiceHealthData } from './common';

interface TrafficGraphResult {
  edges: unknown[];
  nodes: unknown[];
}

export const generateSingleClusterTrafficGraph = (clusterName: string): TrafficGraphResult => {
  const nodes: any[] = [];
  const edges: any[] = [];

  // Cluster box
  nodes.push({
    data: { id: `box-cluster-${clusterName}`, nodeType: 'box', cluster: clusterName, namespace: '', isBox: 'cluster' }
  });

  // Namespace boxes
  nodes.push(
    {
      data: {
        id: 'box-namespace-bookinfo',
        nodeType: 'box',
        cluster: clusterName,
        namespace: 'bookinfo',
        isBox: 'namespace',
        parent: `box-cluster-${clusterName}`
      }
    },
    {
      data: {
        id: 'box-namespace-istio-system',
        nodeType: 'box',
        cluster: clusterName,
        namespace: 'istio-system',
        isBox: 'namespace',
        parent: `box-cluster-${clusterName}`
      }
    }
  );

  // App boxes
  ['productpage', 'details', 'reviews', 'ratings'].forEach(app => {
    nodes.push({
      data: {
        id: `box-app-${app}`,
        nodeType: 'box',
        cluster: clusterName,
        namespace: 'bookinfo',
        app,
        isBox: 'app',
        parent: 'box-namespace-bookinfo'
      }
    });
  });

  // App and service nodes
  nodes.push(
    {
      data: {
        id: 'n0',
        nodeType: 'app',
        cluster: clusterName,
        namespace: 'bookinfo',
        app: 'productpage',
        version: 'v1',
        workload: 'productpage-v1',
        traffic: [{ protocol: 'http', rates: { httpIn: '10.00' } }],
        healthData: createAppHealthData('productpage-v1'),
        isRoot: true,
        parent: 'box-app-productpage'
      }
    },
    {
      data: {
        id: 'n1',
        nodeType: 'app',
        cluster: clusterName,
        namespace: 'bookinfo',
        app: 'details',
        version: 'v1',
        workload: 'details-v1',
        traffic: [{ protocol: 'http', rates: { httpIn: '5.00' } }],
        healthData: createAppHealthData('details-v1'),
        parent: 'box-app-details'
      }
    },
    {
      data: {
        id: 'n2',
        nodeType: 'app',
        cluster: clusterName,
        namespace: 'bookinfo',
        app: 'reviews',
        version: 'v1',
        workload: 'reviews-v1',
        traffic: [{ protocol: 'http', rates: { httpIn: '3.33' } }],
        healthData: createAppHealthData('reviews-v1'),
        parent: 'box-app-reviews'
      }
    },
    {
      data: {
        id: 'n3',
        nodeType: 'app',
        cluster: clusterName,
        namespace: 'bookinfo',
        app: 'reviews',
        version: 'v2',
        workload: 'reviews-v2',
        traffic: [{ protocol: 'http', rates: { httpIn: '3.33' } }],
        healthData: createAppHealthData('reviews-v2'),
        parent: 'box-app-reviews'
      }
    },
    {
      data: {
        id: 'n4',
        nodeType: 'app',
        cluster: clusterName,
        namespace: 'bookinfo',
        app: 'reviews',
        version: 'v3',
        workload: 'reviews-v3',
        traffic: [{ protocol: 'http', rates: { httpIn: '3.34' } }],
        healthData: createAppHealthData('reviews-v3'),
        parent: 'box-app-reviews'
      }
    },
    {
      data: {
        id: 'n5',
        nodeType: 'app',
        cluster: clusterName,
        namespace: 'bookinfo',
        app: 'ratings',
        version: 'v1',
        workload: 'ratings-v1',
        traffic: [{ protocol: 'http', rates: { httpIn: '6.67' } }],
        healthData: createAppHealthData('ratings-v1'),
        parent: 'box-app-ratings'
      }
    },
    {
      data: {
        id: 'n6',
        nodeType: 'service',
        cluster: clusterName,
        namespace: 'bookinfo',
        service: 'productpage',
        app: 'productpage',
        traffic: [{ protocol: 'http', rates: { httpIn: '10.00', httpOut: '10.00' } }],
        healthData: createServiceHealthData(),
        parent: 'box-app-productpage'
      }
    },
    {
      data: {
        id: 'n7',
        nodeType: 'service',
        cluster: clusterName,
        namespace: 'bookinfo',
        service: 'details',
        app: 'details',
        traffic: [{ protocol: 'http', rates: { httpIn: '5.00', httpOut: '5.00' } }],
        healthData: createServiceHealthData(),
        parent: 'box-app-details'
      }
    },
    {
      data: {
        id: 'n8',
        nodeType: 'service',
        cluster: clusterName,
        namespace: 'bookinfo',
        service: 'reviews',
        app: 'reviews',
        traffic: [{ protocol: 'http', rates: { httpIn: '10.00', httpOut: '10.00' } }],
        healthData: createServiceHealthData(),
        parent: 'box-app-reviews'
      }
    },
    {
      data: {
        id: 'n9',
        nodeType: 'service',
        cluster: clusterName,
        namespace: 'bookinfo',
        service: 'ratings',
        app: 'ratings',
        traffic: [{ protocol: 'http', rates: { httpIn: '6.67', httpOut: '6.67' } }],
        healthData: createServiceHealthData(),
        parent: 'box-app-ratings'
      }
    },
    {
      data: {
        id: 'n10',
        nodeType: 'workload',
        cluster: clusterName,
        namespace: 'istio-system',
        workload: 'istio-ingressgateway',
        app: 'istio-ingressgateway',
        isRoot: true,
        isOutside: true,
        isGateway: { ingressInfo: { hostnames: ['*'] } },
        traffic: [{ protocol: 'http', rates: { httpOut: '10.00' } }],
        healthData: {
          workloadStatus: {
            name: 'istio-ingressgateway',
            desiredReplicas: 1,
            currentReplicas: 1,
            availableReplicas: 1,
            syncedProxies: 1
          },
          requests: { inbound: { http: { '200': 100 } }, outbound: { http: { '200': 100 } }, healthAnnotations: {} }
        },
        parent: 'box-namespace-istio-system'
      }
    }
  );

  // Edges
  edges.push(
    {
      data: {
        id: 'e0',
        source: 'n10',
        target: 'n6',
        traffic: {
          protocol: 'http',
          rates: { http: '10.00', httpPercentReq: '100.0' },
          responses: { '200': { flags: { '-': '100.0' }, hosts: { 'productpage:9080': '100.0' } } }
        }
      }
    },
    {
      data: {
        id: 'e1',
        source: 'n6',
        target: 'n0',
        traffic: {
          protocol: 'http',
          rates: { http: '10.00', httpPercentReq: '100.0' },
          responses: { '200': { flags: { '-': '100.0' }, hosts: { 'productpage:9080': '100.0' } } }
        }
      }
    },
    {
      data: {
        id: 'e2',
        source: 'n0',
        target: 'n7',
        traffic: {
          protocol: 'http',
          rates: { http: '5.00', httpPercentReq: '50.0' },
          responses: { '200': { flags: { '-': '100.0' }, hosts: { 'details:9080': '100.0' } } }
        }
      }
    },
    {
      data: {
        id: 'e3',
        source: 'n0',
        target: 'n8',
        traffic: {
          protocol: 'http',
          rates: { http: '10.00', httpPercentReq: '100.0' },
          responses: { '200': { flags: { '-': '100.0' }, hosts: { 'reviews:9080': '100.0' } } }
        }
      }
    },
    {
      data: {
        id: 'e4',
        source: 'n7',
        target: 'n1',
        traffic: {
          protocol: 'http',
          rates: { http: '5.00', httpPercentReq: '100.0' },
          responses: { '200': { flags: { '-': '100.0' }, hosts: { 'details:9080': '100.0' } } }
        }
      }
    },
    {
      data: {
        id: 'e5',
        source: 'n8',
        target: 'n2',
        traffic: {
          protocol: 'http',
          rates: { http: '3.33', httpPercentReq: '33.3' },
          responses: { '200': { flags: { '-': '100.0' }, hosts: { 'reviews:9080': '100.0' } } }
        }
      }
    },
    {
      data: {
        id: 'e6',
        source: 'n8',
        target: 'n3',
        traffic: {
          protocol: 'http',
          rates: { http: '3.33', httpPercentReq: '33.3' },
          responses: { '200': { flags: { '-': '100.0' }, hosts: { 'reviews:9080': '100.0' } } }
        }
      }
    },
    {
      data: {
        id: 'e7',
        source: 'n8',
        target: 'n4',
        traffic: {
          protocol: 'http',
          rates: { http: '3.34', httpPercentReq: '33.4' },
          responses: { '200': { flags: { '-': '100.0' }, hosts: { 'reviews:9080': '100.0' } } }
        }
      }
    },
    {
      data: {
        id: 'e8',
        source: 'n3',
        target: 'n9',
        traffic: {
          protocol: 'http',
          rates: { http: '3.33', httpPercentReq: '100.0' },
          responses: { '200': { flags: { '-': '100.0' }, hosts: { 'ratings:9080': '100.0' } } }
        }
      }
    },
    {
      data: {
        id: 'e9',
        source: 'n4',
        target: 'n9',
        traffic: {
          protocol: 'http',
          rates: { http: '3.34', httpPercentReq: '100.0' },
          responses: { '200': { flags: { '-': '100.0' }, hosts: { 'ratings:9080': '100.0' } } }
        }
      }
    },
    {
      data: {
        id: 'e10',
        source: 'n9',
        target: 'n5',
        traffic: {
          protocol: 'http',
          rates: { http: '6.67', httpPercentReq: '100.0' },
          responses: { '200': { flags: { '-': '100.0' }, hosts: { 'ratings:9080': '100.0' } } }
        }
      }
    }
  );

  return { nodes, edges };
};
