// Multicluster traffic graph
// Split bookinfo topology: cluster-east (productpage + details), cluster-west (reviews + ratings)
import { getScenarioConfig } from '../../scenarios';
import { createAppHealthData, createServiceHealthData, createEdgeTraffic } from './common';

interface ClusterConfig {
  accessible: boolean;
  isHome: boolean;
  name: string;
  namespaces: string[];
}

interface TrafficGraphResult {
  edges: unknown[];
  nodes: unknown[];
}

export const generateMultiClusterTrafficGraph = (): TrafficGraphResult => {
  const nodes: any[] = [];
  const edges: any[] = [];
  let edgeIdCounter = 0;

  const scenarioConfig = getScenarioConfig();
  const clustersWithBookinfo = scenarioConfig.clusters.filter(c => c.namespaces.includes('bookinfo'));
  const eastCluster = clustersWithBookinfo.find(c => c.isHome) || clustersWithBookinfo[0];
  const westCluster = clustersWithBookinfo.find(c => !c.isHome) || clustersWithBookinfo[1];

  // Add cluster boxes for clusters with bookinfo
  [eastCluster, westCluster].filter(Boolean).forEach((cluster: ClusterConfig | undefined) => {
    if (!cluster) return;
    nodes.push({
      data: {
        id: `box-cluster-${cluster.name}`,
        nodeType: 'box',
        cluster: cluster.name,
        namespace: '',
        isBox: 'cluster'
      }
    });

    // Add bookinfo namespace box
    nodes.push({
      data: {
        id: `box-namespace-bookinfo-${cluster.name}`,
        nodeType: 'box',
        cluster: cluster.name,
        namespace: 'bookinfo',
        isBox: 'namespace',
        parent: `box-cluster-${cluster.name}`
      }
    });

    // Add istio-system namespace box
    nodes.push({
      data: {
        id: `box-namespace-istio-system-${cluster.name}`,
        nodeType: 'box',
        cluster: cluster.name,
        namespace: 'istio-system',
        isBox: 'namespace',
        parent: `box-cluster-${cluster.name}`
      }
    });
  });

  // ===== CLUSTER-EAST (home): productpage + details =====
  if (eastCluster) {
    const east = eastCluster.name;

    // Ingress gateway
    nodes.push({
      data: {
        id: `gateway-${east}`,
        nodeType: 'workload',
        cluster: east,
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
        parent: `box-namespace-istio-system-${east}`
      }
    });

    // App boxes for productpage and details
    ['productpage', 'details'].forEach(app => {
      nodes.push({
        data: {
          id: `box-app-${app}-${east}`,
          nodeType: 'box',
          cluster: east,
          namespace: 'bookinfo',
          app: app,
          isBox: 'app',
          parent: `box-namespace-bookinfo-${east}`
        }
      });
    });

    // Productpage app and service
    nodes.push(
      {
        data: {
          id: `pp-app-${east}`,
          nodeType: 'app',
          cluster: east,
          namespace: 'bookinfo',
          app: 'productpage',
          version: 'v1',
          workload: 'productpage-v1',
          traffic: [{ protocol: 'http', rates: { httpIn: '10.00', httpOut: '15.00' } }],
          healthData: createAppHealthData('productpage-v1', 'bookinfo'),
          isRoot: true,
          parent: `box-app-productpage-${east}`
        }
      },
      {
        data: {
          id: `pp-svc-${east}`,
          nodeType: 'service',
          cluster: east,
          namespace: 'bookinfo',
          service: 'productpage',
          app: 'productpage',
          traffic: [{ protocol: 'http', rates: { httpIn: '10.00', httpOut: '10.00' } }],
          healthData: createServiceHealthData('productpage', 'bookinfo'),
          parent: `box-app-productpage-${east}`
        }
      }
    );

    // Details app and service
    nodes.push(
      {
        data: {
          id: `det-app-${east}`,
          nodeType: 'app',
          cluster: east,
          namespace: 'bookinfo',
          app: 'details',
          version: 'v1',
          workload: 'details-v1',
          traffic: [{ protocol: 'http', rates: { httpIn: '5.00' } }],
          healthData: createAppHealthData('details-v1', 'bookinfo'),
          parent: `box-app-details-${east}`
        }
      },
      {
        data: {
          id: `det-svc-${east}`,
          nodeType: 'service',
          cluster: east,
          namespace: 'bookinfo',
          service: 'details',
          app: 'details',
          traffic: [{ protocol: 'http', rates: { httpIn: '5.00', httpOut: '5.00' } }],
          healthData: createServiceHealthData('details', 'bookinfo'),
          parent: `box-app-details-${east}`
        }
      }
    );

    // Edges within cluster-east - use createEdgeTraffic for scenario-aware responses
    edges.push(
      {
        data: {
          id: `e${edgeIdCounter++}`,
          source: `gateway-${east}`,
          target: `pp-svc-${east}`,
          traffic: createEdgeTraffic('productpage', 'productpage:9080', '10.00', 'bookinfo')
        }
      },
      {
        data: {
          id: `e${edgeIdCounter++}`,
          source: `pp-svc-${east}`,
          target: `pp-app-${east}`,
          traffic: createEdgeTraffic('productpage', 'productpage:9080', '10.00', 'bookinfo')
        }
      },
      {
        data: {
          id: `e${edgeIdCounter++}`,
          source: `pp-app-${east}`,
          target: `det-svc-${east}`,
          traffic: createEdgeTraffic('details', 'details:9080', '5.00', 'bookinfo')
        }
      },
      {
        data: {
          id: `e${edgeIdCounter++}`,
          source: `det-svc-${east}`,
          target: `det-app-${east}`,
          traffic: createEdgeTraffic('details', 'details:9080', '5.00', 'bookinfo')
        }
      }
    );
  }

  // ===== CLUSTER-WEST: reviews + ratings =====
  if (westCluster) {
    const west = westCluster.name;

    // App boxes for reviews and ratings
    ['reviews', 'ratings'].forEach(app => {
      nodes.push({
        data: {
          id: `box-app-${app}-${west}`,
          nodeType: 'box',
          cluster: west,
          namespace: 'bookinfo',
          app: app,
          isBox: 'app',
          parent: `box-namespace-bookinfo-${west}`
        }
      });
    });

    // Reviews service and apps (v1, v2, v3)
    nodes.push(
      {
        data: {
          id: `rev-svc-${west}`,
          nodeType: 'service',
          cluster: west,
          namespace: 'bookinfo',
          service: 'reviews',
          app: 'reviews',
          traffic: [{ protocol: 'http', rates: { httpIn: '10.00', httpOut: '10.00' } }],
          healthData: createServiceHealthData('reviews', 'bookinfo'),
          parent: `box-app-reviews-${west}`
        }
      },
      {
        data: {
          id: `rev-v1-${west}`,
          nodeType: 'app',
          cluster: west,
          namespace: 'bookinfo',
          app: 'reviews',
          version: 'v1',
          workload: 'reviews-v1',
          traffic: [{ protocol: 'http', rates: { httpIn: '3.33' } }],
          healthData: createAppHealthData('reviews-v1', 'bookinfo'),
          parent: `box-app-reviews-${west}`
        }
      },
      {
        data: {
          id: `rev-v2-${west}`,
          nodeType: 'app',
          cluster: west,
          namespace: 'bookinfo',
          app: 'reviews',
          version: 'v2',
          workload: 'reviews-v2',
          traffic: [{ protocol: 'http', rates: { httpIn: '3.33', httpOut: '3.33' } }],
          healthData: createAppHealthData('reviews-v2', 'bookinfo'),
          parent: `box-app-reviews-${west}`
        }
      },
      {
        data: {
          id: `rev-v3-${west}`,
          nodeType: 'app',
          cluster: west,
          namespace: 'bookinfo',
          app: 'reviews',
          version: 'v3',
          workload: 'reviews-v3',
          traffic: [{ protocol: 'http', rates: { httpIn: '3.34', httpOut: '3.34' } }],
          healthData: createAppHealthData('reviews-v3', 'bookinfo'),
          parent: `box-app-reviews-${west}`
        }
      }
    );

    // Ratings app and service
    nodes.push(
      {
        data: {
          id: `rat-app-${west}`,
          nodeType: 'app',
          cluster: west,
          namespace: 'bookinfo',
          app: 'ratings',
          version: 'v1',
          workload: 'ratings-v1',
          traffic: [{ protocol: 'http', rates: { httpIn: '6.67' } }],
          healthData: createAppHealthData('ratings-v1', 'bookinfo'),
          parent: `box-app-ratings-${west}`
        }
      },
      {
        data: {
          id: `rat-svc-${west}`,
          nodeType: 'service',
          cluster: west,
          namespace: 'bookinfo',
          service: 'ratings',
          app: 'ratings',
          traffic: [{ protocol: 'http', rates: { httpIn: '6.67', httpOut: '6.67' } }],
          healthData: createServiceHealthData('ratings', 'bookinfo'),
          parent: `box-app-ratings-${west}`
        }
      }
    );

    // Edges within cluster-west - use createEdgeTraffic for scenario-aware responses
    edges.push(
      {
        data: {
          id: `e${edgeIdCounter++}`,
          source: `rev-svc-${west}`,
          target: `rev-v1-${west}`,
          traffic: createEdgeTraffic('reviews', 'reviews:9080', '3.33', 'bookinfo')
        }
      },
      {
        data: {
          id: `e${edgeIdCounter++}`,
          source: `rev-svc-${west}`,
          target: `rev-v2-${west}`,
          traffic: createEdgeTraffic('reviews', 'reviews:9080', '3.33', 'bookinfo')
        }
      },
      {
        data: {
          id: `e${edgeIdCounter++}`,
          source: `rev-svc-${west}`,
          target: `rev-v3-${west}`,
          traffic: createEdgeTraffic('reviews', 'reviews:9080', '3.34', 'bookinfo')
        }
      },
      {
        data: {
          id: `e${edgeIdCounter++}`,
          source: `rev-v2-${west}`,
          target: `rat-svc-${west}`,
          traffic: createEdgeTraffic('ratings', 'ratings:9080', '3.33', 'bookinfo')
        }
      },
      {
        data: {
          id: `e${edgeIdCounter++}`,
          source: `rev-v3-${west}`,
          target: `rat-svc-${west}`,
          traffic: createEdgeTraffic('ratings', 'ratings:9080', '3.34', 'bookinfo')
        }
      },
      {
        data: {
          id: `e${edgeIdCounter++}`,
          source: `rat-svc-${west}`,
          target: `rat-app-${west}`,
          traffic: createEdgeTraffic('ratings', 'ratings:9080', '6.67', 'bookinfo')
        }
      }
    );
  }

  // ===== CROSS-CLUSTER EDGE: productpage (east) -> reviews service (west) =====
  if (eastCluster && westCluster) {
    const east = eastCluster.name;
    const west = westCluster.name;
    edges.push({
      data: {
        id: `e-cross-${edgeIdCounter++}`,
        source: `pp-app-${east}`,
        target: `rev-svc-${west}`,
        traffic: createEdgeTraffic('reviews', 'reviews.bookinfo.svc.cluster.local:9080', '10.00', 'bookinfo')
      }
    });
  }

  return { nodes, edges };
};
