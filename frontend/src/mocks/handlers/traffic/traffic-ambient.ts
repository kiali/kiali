// Ambient mesh traffic graph (TCP traffic via ztunnel)
import { createAppHealthData, createServiceHealthData } from './common';

interface TrafficGraphResult {
  edges: unknown[];
  nodes: unknown[];
}

export const generateAmbientTrafficGraph = (clusterName: string): TrafficGraphResult => {
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
    },
    {
      data: {
        id: 'box-namespace-kiali-traffic-generator',
        nodeType: 'box',
        cluster: clusterName,
        namespace: 'kiali-traffic-generator',
        isBox: 'namespace',
        parent: `box-cluster-${clusterName}`
      }
    }
  );

  // App boxes for bookinfo
  ['productpage', 'details', 'reviews', 'ratings'].forEach(app => {
    nodes.push({
      data: {
        id: `box-app-${app}`,
        nodeType: 'box',
        cluster: clusterName,
        namespace: 'bookinfo',
        app,
        isBox: 'app',
        parent: 'box-namespace-bookinfo',
        isAmbient: true
      }
    });
  });

  // Traffic generator (external traffic source)
  nodes.push({
    data: {
      id: 'traffic-generator',
      nodeType: 'workload',
      cluster: clusterName,
      namespace: 'kiali-traffic-generator',
      workload: 'kiali-traffic-generator',
      app: 'kiali-traffic-generator',
      isRoot: true,
      isOutside: true,
      traffic: [{ protocol: 'http', rates: { httpOut: '10.00' } }],
      healthData: {
        workloadStatus: {
          name: 'kiali-traffic-generator',
          desiredReplicas: 1,
          currentReplicas: 1,
          availableReplicas: 1,
          syncedProxies: 0
        },
        requests: { inbound: {}, outbound: { http: { '200': 100 } }, healthAnnotations: {} }
      },
      parent: 'box-namespace-kiali-traffic-generator'
    }
  });

  // K8s Gateway API Gateway (bookinfo-gateway-istio)
  nodes.push({
    data: {
      id: 'bookinfo-gateway',
      nodeType: 'workload',
      cluster: clusterName,
      namespace: 'bookinfo',
      workload: 'bookinfo-gateway-istio',
      app: 'bookinfo-gateway-istio',
      isGateway: {
        ingressInfo: { hostnames: ['*'] },
        gatewayAPIInfo: { gatewayName: 'bookinfo-gateway', gatewayClass: 'istio' }
      },
      isAmbient: true,
      traffic: [{ protocol: 'http', rates: { httpIn: '10.00', httpOut: '10.00' } }],
      healthData: {
        workloadStatus: {
          name: 'bookinfo-gateway-istio',
          desiredReplicas: 1,
          currentReplicas: 1,
          availableReplicas: 1,
          syncedProxies: 1
        },
        requests: { inbound: { http: { '200': 100 } }, outbound: { http: { '200': 100 } }, healthAnnotations: {} }
      },
      parent: 'box-namespace-bookinfo'
    }
  });

  // Prometheus (in istio-system)
  nodes.push({
    data: {
      id: 'prometheus',
      nodeType: 'workload',
      cluster: clusterName,
      namespace: 'istio-system',
      workload: 'prometheus',
      app: 'prometheus',
      traffic: [{ protocol: 'http', rates: { httpIn: '0.50' } }],
      healthData: {
        workloadStatus: {
          name: 'prometheus',
          desiredReplicas: 1,
          currentReplicas: 1,
          availableReplicas: 1,
          syncedProxies: 0
        },
        requests: { inbound: { http: { '200': 100 } }, outbound: {}, healthAnnotations: {} }
      },
      parent: 'box-namespace-istio-system'
    }
  });

  // Bookinfo services and apps (ambient - no sidecars, TCP traffic via ztunnel)
  // Productpage
  nodes.push(
    {
      data: {
        id: 'pp-svc',
        nodeType: 'service',
        cluster: clusterName,
        namespace: 'bookinfo',
        service: 'productpage',
        app: 'productpage',
        isAmbient: true,
        traffic: [{ protocol: 'tcp', rates: { tcpIn: '142.47', tcpOut: '142.47' } }],
        healthData: createServiceHealthData('productpage', 'bookinfo'),
        parent: 'box-app-productpage'
      }
    },
    {
      data: {
        id: 'pp-v1',
        nodeType: 'app',
        cluster: clusterName,
        namespace: 'bookinfo',
        app: 'productpage',
        version: 'v1',
        workload: 'productpage-v1',
        isAmbient: true,
        traffic: [{ protocol: 'tcp', rates: { tcpIn: '142.47', tcpOut: '213.70' } }],
        healthData: createAppHealthData('productpage-v1', 'bookinfo'),
        parent: 'box-app-productpage'
      }
    }
  );

  // Details
  nodes.push(
    {
      data: {
        id: 'det-svc',
        nodeType: 'service',
        cluster: clusterName,
        namespace: 'bookinfo',
        service: 'details',
        app: 'details',
        isAmbient: true,
        traffic: [{ protocol: 'tcp', rates: { tcpIn: '71.24', tcpOut: '71.24' } }],
        healthData: createServiceHealthData('details', 'bookinfo'),
        parent: 'box-app-details'
      }
    },
    {
      data: {
        id: 'det-v1',
        nodeType: 'app',
        cluster: clusterName,
        namespace: 'bookinfo',
        app: 'details',
        version: 'v1',
        workload: 'details-v1',
        isAmbient: true,
        traffic: [{ protocol: 'tcp', rates: { tcpIn: '71.24' } }],
        healthData: createAppHealthData('details-v1', 'bookinfo'),
        parent: 'box-app-details'
      }
    }
  );

  // Reviews
  nodes.push(
    {
      data: {
        id: 'rev-svc',
        nodeType: 'service',
        cluster: clusterName,
        namespace: 'bookinfo',
        service: 'reviews',
        app: 'reviews',
        isAmbient: true,
        traffic: [{ protocol: 'tcp', rates: { tcpIn: '142.47', tcpOut: '142.47' } }],
        healthData: createServiceHealthData('reviews', 'bookinfo'),
        parent: 'box-app-reviews'
      }
    },
    {
      data: {
        id: 'rev-v1',
        nodeType: 'app',
        cluster: clusterName,
        namespace: 'bookinfo',
        app: 'reviews',
        version: 'v1',
        workload: 'reviews-v1',
        isAmbient: true,
        traffic: [{ protocol: 'tcp', rates: { tcpIn: '47.49' } }],
        healthData: createAppHealthData('reviews-v1', 'bookinfo'),
        parent: 'box-app-reviews'
      }
    },
    {
      data: {
        id: 'rev-v2',
        nodeType: 'app',
        cluster: clusterName,
        namespace: 'bookinfo',
        app: 'reviews',
        version: 'v2',
        workload: 'reviews-v2',
        isAmbient: true,
        traffic: [{ protocol: 'tcp', rates: { tcpIn: '47.49', tcpOut: '47.49' } }],
        healthData: createAppHealthData('reviews-v2', 'bookinfo'),
        parent: 'box-app-reviews'
      }
    },
    {
      data: {
        id: 'rev-v3',
        nodeType: 'app',
        cluster: clusterName,
        namespace: 'bookinfo',
        app: 'reviews',
        version: 'v3',
        workload: 'reviews-v3',
        isAmbient: true,
        traffic: [{ protocol: 'tcp', rates: { tcpIn: '47.49', tcpOut: '47.49' } }],
        healthData: createAppHealthData('reviews-v3', 'bookinfo'),
        parent: 'box-app-reviews'
      }
    }
  );

  // Ratings
  nodes.push(
    {
      data: {
        id: 'rat-svc',
        nodeType: 'service',
        cluster: clusterName,
        namespace: 'bookinfo',
        service: 'ratings',
        app: 'ratings',
        isAmbient: true,
        traffic: [{ protocol: 'tcp', rates: { tcpIn: '94.98', tcpOut: '94.98' } }],
        healthData: createServiceHealthData('ratings', 'bookinfo'),
        parent: 'box-app-ratings'
      }
    },
    {
      data: {
        id: 'rat-v1',
        nodeType: 'app',
        cluster: clusterName,
        namespace: 'bookinfo',
        app: 'ratings',
        version: 'v1',
        workload: 'ratings-v1',
        isAmbient: true,
        traffic: [{ protocol: 'tcp', rates: { tcpIn: '94.98' } }],
        healthData: createAppHealthData('ratings-v1', 'bookinfo'),
        parent: 'box-app-ratings'
      }
    }
  );

  // Edges for ambient topology (TCP traffic via ztunnel - blue edges)
  edges.push(
    // Traffic generator -> gateway (TCP)
    {
      data: {
        id: 'e0',
        source: 'traffic-generator',
        target: 'bookinfo-gateway',
        traffic: {
          protocol: 'tcp',
          rates: { tcp: '142.47' },
          responses: { '-': { flags: { '-': '100.0' }, hosts: { 'bookinfo-gateway-istio:80': '100.0' } } }
        }
      }
    },
    // Gateway -> productpage service (TCP)
    {
      data: {
        id: 'e1',
        source: 'bookinfo-gateway',
        target: 'pp-svc',
        traffic: {
          protocol: 'tcp',
          rates: { tcp: '142.47' },
          responses: { '-': { flags: { '-': '100.0' }, hosts: { 'productpage:9080': '100.0' } } }
        }
      }
    },
    // Productpage service -> productpage app (TCP)
    {
      data: {
        id: 'e2',
        source: 'pp-svc',
        target: 'pp-v1',
        traffic: {
          protocol: 'tcp',
          rates: { tcp: '142.47' },
          responses: { '-': { flags: { '-': '100.0' }, hosts: { 'productpage:9080': '100.0' } } }
        }
      }
    },
    // Productpage -> details service (TCP)
    {
      data: {
        id: 'e3',
        source: 'pp-v1',
        target: 'det-svc',
        traffic: {
          protocol: 'tcp',
          rates: { tcp: '71.24' },
          responses: { '-': { flags: { '-': '100.0' }, hosts: { 'details:9080': '100.0' } } }
        }
      }
    },
    // Details service -> details app (TCP)
    {
      data: {
        id: 'e4',
        source: 'det-svc',
        target: 'det-v1',
        traffic: {
          protocol: 'tcp',
          rates: { tcp: '71.24' },
          responses: { '-': { flags: { '-': '100.0' }, hosts: { 'details:9080': '100.0' } } }
        }
      }
    },
    // Productpage -> reviews service (TCP)
    {
      data: {
        id: 'e5',
        source: 'pp-v1',
        target: 'rev-svc',
        traffic: {
          protocol: 'tcp',
          rates: { tcp: '142.47' },
          responses: { '-': { flags: { '-': '100.0' }, hosts: { 'reviews:9080': '100.0' } } }
        }
      }
    },
    // Reviews service -> reviews apps (TCP)
    {
      data: {
        id: 'e6',
        source: 'rev-svc',
        target: 'rev-v1',
        traffic: {
          protocol: 'tcp',
          rates: { tcp: '47.49' },
          responses: { '-': { flags: { '-': '100.0' }, hosts: { 'reviews:9080': '100.0' } } }
        }
      }
    },
    {
      data: {
        id: 'e7',
        source: 'rev-svc',
        target: 'rev-v2',
        traffic: {
          protocol: 'tcp',
          rates: { tcp: '47.49' },
          responses: { '-': { flags: { '-': '100.0' }, hosts: { 'reviews:9080': '100.0' } } }
        }
      }
    },
    {
      data: {
        id: 'e8',
        source: 'rev-svc',
        target: 'rev-v3',
        traffic: {
          protocol: 'tcp',
          rates: { tcp: '47.49' },
          responses: { '-': { flags: { '-': '100.0' }, hosts: { 'reviews:9080': '100.0' } } }
        }
      }
    },
    // Reviews v2/v3 -> ratings service (TCP)
    {
      data: {
        id: 'e9',
        source: 'rev-v2',
        target: 'rat-svc',
        traffic: {
          protocol: 'tcp',
          rates: { tcp: '47.49' },
          responses: { '-': { flags: { '-': '100.0' }, hosts: { 'ratings:9080': '100.0' } } }
        }
      }
    },
    {
      data: {
        id: 'e10',
        source: 'rev-v3',
        target: 'rat-svc',
        traffic: {
          protocol: 'tcp',
          rates: { tcp: '47.49' },
          responses: { '-': { flags: { '-': '100.0' }, hosts: { 'ratings:9080': '100.0' } } }
        }
      }
    },
    // Ratings service -> ratings app (TCP)
    {
      data: {
        id: 'e11',
        source: 'rat-svc',
        target: 'rat-v1',
        traffic: {
          protocol: 'tcp',
          rates: { tcp: '94.98' },
          responses: { '-': { flags: { '-': '100.0' }, hosts: { 'ratings:9080': '100.0' } } }
        }
      }
    }
  );

  return { nodes, edges };
};
