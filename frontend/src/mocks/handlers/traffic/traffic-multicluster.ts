// Multicluster traffic graph
// Split bookinfo topology: cluster-east (productpage + details), cluster-west (reviews + ratings)
import { getScenarioConfig } from '../../scenarios';
import { createAppHealthData, createServiceHealthData, createEdgeTraffic, createNodeTraffic } from './common';

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
          traffic: createNodeTraffic('productpage', '10.00', '15.00', 'bookinfo', east),
          healthData: createAppHealthData('productpage-v1', 'bookinfo', east),
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
          traffic: createNodeTraffic('productpage', '10.00', '10.00', 'bookinfo', east),
          healthData: createServiceHealthData('productpage', 'bookinfo', east),
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
          traffic: createNodeTraffic('details', '5.00', undefined, 'bookinfo', east),
          healthData: createAppHealthData('details-v1', 'bookinfo', east),
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
          traffic: createNodeTraffic('details', '5.00', '5.00', 'bookinfo', east),
          healthData: createServiceHealthData('details', 'bookinfo', east),
          parent: `box-app-details-${east}`
        }
      }
    );

    // Edges within cluster-east - use createEdgeTraffic for scenario-aware responses
    // Extract healthStatus from traffic and put it on edge data for graph coloring
    const ppTraffic1 = createEdgeTraffic('productpage', 'productpage:9080', '10.00', 'bookinfo', east);
    const ppTraffic2 = createEdgeTraffic('productpage', 'productpage:9080', '10.00', 'bookinfo', east);
    const detTraffic1 = createEdgeTraffic('details', 'details:9080', '5.00', 'bookinfo', east);
    const detTraffic2 = createEdgeTraffic('details', 'details:9080', '5.00', 'bookinfo', east);

    edges.push(
      {
        data: {
          id: `e${edgeIdCounter++}`,
          source: `gateway-${east}`,
          target: `pp-svc-${east}`,
          traffic: { protocol: ppTraffic1.protocol, rates: ppTraffic1.rates, responses: ppTraffic1.responses },
          healthStatus: ppTraffic1.healthStatus
        }
      },
      {
        data: {
          id: `e${edgeIdCounter++}`,
          source: `pp-svc-${east}`,
          target: `pp-app-${east}`,
          traffic: { protocol: ppTraffic2.protocol, rates: ppTraffic2.rates, responses: ppTraffic2.responses },
          healthStatus: ppTraffic2.healthStatus
        }
      },
      {
        data: {
          id: `e${edgeIdCounter++}`,
          source: `pp-app-${east}`,
          target: `det-svc-${east}`,
          traffic: { protocol: detTraffic1.protocol, rates: detTraffic1.rates, responses: detTraffic1.responses },
          healthStatus: detTraffic1.healthStatus
        }
      },
      {
        data: {
          id: `e${edgeIdCounter++}`,
          source: `det-svc-${east}`,
          target: `det-app-${east}`,
          traffic: { protocol: detTraffic2.protocol, rates: detTraffic2.rates, responses: detTraffic2.responses },
          healthStatus: detTraffic2.healthStatus
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
          traffic: createNodeTraffic('reviews', '10.00', '10.00', 'bookinfo', west),
          healthData: createServiceHealthData('reviews', 'bookinfo', west),
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
          traffic: createNodeTraffic('reviews', '3.33', undefined, 'bookinfo', west),
          healthData: createAppHealthData('reviews-v1', 'bookinfo', west),
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
          traffic: createNodeTraffic('reviews', '3.33', '3.33', 'bookinfo', west),
          healthData: createAppHealthData('reviews-v2', 'bookinfo', west),
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
          traffic: createNodeTraffic('reviews', '3.34', '3.34', 'bookinfo', west),
          healthData: createAppHealthData('reviews-v3', 'bookinfo', west),
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
          traffic: createNodeTraffic('ratings', '6.67', undefined, 'bookinfo', west),
          healthData: createAppHealthData('ratings-v1', 'bookinfo', west),
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
          traffic: createNodeTraffic('ratings', '6.67', '6.67', 'bookinfo', west),
          healthData: createServiceHealthData('ratings', 'bookinfo', west),
          parent: `box-app-ratings-${west}`
        }
      }
    );

    // Edges within cluster-west - use createEdgeTraffic for scenario-aware responses
    const revTraffic1 = createEdgeTraffic('reviews', 'reviews:9080', '3.33', 'bookinfo', west);
    const revTraffic2 = createEdgeTraffic('reviews', 'reviews:9080', '3.33', 'bookinfo', west);
    const revTraffic3 = createEdgeTraffic('reviews', 'reviews:9080', '3.34', 'bookinfo', west);
    const ratTraffic1 = createEdgeTraffic('ratings', 'ratings:9080', '3.33', 'bookinfo', west);
    const ratTraffic2 = createEdgeTraffic('ratings', 'ratings:9080', '3.34', 'bookinfo', west);
    const ratTraffic3 = createEdgeTraffic('ratings', 'ratings:9080', '6.67', 'bookinfo', west);

    edges.push(
      {
        data: {
          id: `e${edgeIdCounter++}`,
          source: `rev-svc-${west}`,
          target: `rev-v1-${west}`,
          traffic: { protocol: revTraffic1.protocol, rates: revTraffic1.rates, responses: revTraffic1.responses },
          healthStatus: revTraffic1.healthStatus
        }
      },
      {
        data: {
          id: `e${edgeIdCounter++}`,
          source: `rev-svc-${west}`,
          target: `rev-v2-${west}`,
          traffic: { protocol: revTraffic2.protocol, rates: revTraffic2.rates, responses: revTraffic2.responses },
          healthStatus: revTraffic2.healthStatus
        }
      },
      {
        data: {
          id: `e${edgeIdCounter++}`,
          source: `rev-svc-${west}`,
          target: `rev-v3-${west}`,
          traffic: { protocol: revTraffic3.protocol, rates: revTraffic3.rates, responses: revTraffic3.responses },
          healthStatus: revTraffic3.healthStatus
        }
      },
      {
        data: {
          id: `e${edgeIdCounter++}`,
          source: `rev-v2-${west}`,
          target: `rat-svc-${west}`,
          traffic: { protocol: ratTraffic1.protocol, rates: ratTraffic1.rates, responses: ratTraffic1.responses },
          healthStatus: ratTraffic1.healthStatus
        }
      },
      {
        data: {
          id: `e${edgeIdCounter++}`,
          source: `rev-v3-${west}`,
          target: `rat-svc-${west}`,
          traffic: { protocol: ratTraffic2.protocol, rates: ratTraffic2.rates, responses: ratTraffic2.responses },
          healthStatus: ratTraffic2.healthStatus
        }
      },
      {
        data: {
          id: `e${edgeIdCounter++}`,
          source: `rat-svc-${west}`,
          target: `rat-app-${west}`,
          traffic: { protocol: ratTraffic3.protocol, rates: ratTraffic3.rates, responses: ratTraffic3.responses },
          healthStatus: ratTraffic3.healthStatus
        }
      }
    );
  }

  // ===== CROSS-CLUSTER EDGE: productpage (east) -> reviews service (west) =====
  if (eastCluster && westCluster) {
    const east = eastCluster.name;
    const west = westCluster.name;
    const crossTraffic = createEdgeTraffic(
      'reviews',
      'reviews.bookinfo.svc.cluster.local:9080',
      '10.00',
      'bookinfo',
      west
    );
    edges.push({
      data: {
        id: `e-cross-${edgeIdCounter++}`,
        source: `pp-app-${east}`,
        target: `rev-svc-${west}`,
        traffic: { protocol: crossTraffic.protocol, rates: crossTraffic.rates, responses: crossTraffic.responses },
        healthStatus: crossTraffic.healthStatus
      }
    });
  }

  return { nodes, edges };
};
