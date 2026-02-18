// Single cluster traffic graph (sidecar-based bookinfo topology)
import { createAppHealthData, createServiceHealthData, createEdgeTraffic, createNodeTraffic } from './common';

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
        traffic: createNodeTraffic('productpage', '10.00', undefined, 'bookinfo', clusterName),
        healthData: createAppHealthData('productpage-v1', 'bookinfo', clusterName),
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
        traffic: createNodeTraffic('details', '5.00', undefined, 'bookinfo', clusterName),
        healthData: createAppHealthData('details-v1', 'bookinfo', clusterName),
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
        traffic: createNodeTraffic('reviews', '3.33', undefined, 'bookinfo', clusterName),
        healthData: createAppHealthData('reviews-v1', 'bookinfo', clusterName),
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
        traffic: createNodeTraffic('reviews', '3.33', undefined, 'bookinfo', clusterName),
        healthData: createAppHealthData('reviews-v2', 'bookinfo', clusterName),
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
        traffic: createNodeTraffic('reviews', '3.34', undefined, 'bookinfo', clusterName),
        healthData: createAppHealthData('reviews-v3', 'bookinfo', clusterName),
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
        traffic: createNodeTraffic('ratings', '6.67', undefined, 'bookinfo', clusterName),
        healthData: createAppHealthData('ratings-v1', 'bookinfo', clusterName),
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
        traffic: createNodeTraffic('productpage', '10.00', '10.00', 'bookinfo', clusterName),
        healthData: createServiceHealthData('productpage', 'bookinfo', clusterName),
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
        traffic: createNodeTraffic('details', '5.00', '5.00', 'bookinfo', clusterName),
        healthData: createServiceHealthData('details', 'bookinfo', clusterName),
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
        traffic: createNodeTraffic('reviews', '10.00', '10.00', 'bookinfo', clusterName),
        healthData: createServiceHealthData('reviews', 'bookinfo', clusterName),
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
        traffic: createNodeTraffic('ratings', '6.67', '6.67', 'bookinfo', clusterName),
        healthData: createServiceHealthData('ratings', 'bookinfo', clusterName),
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

  // Helper to create edge with healthStatus
  const makeEdge = (
    id: string,
    source: string,
    target: string,
    targetName: string,
    host: string,
    rate: string
  ): { data: Record<string, unknown> } => {
    const trafficData = createEdgeTraffic(targetName, host, rate, 'bookinfo', clusterName);
    return {
      data: {
        id,
        source,
        target,
        traffic: { protocol: trafficData.protocol, rates: trafficData.rates, responses: trafficData.responses },
        healthStatus: trafficData.healthStatus
      }
    };
  };

  // Edges - traffic responses based on target's health
  edges.push(
    makeEdge('e0', 'n10', 'n6', 'productpage', 'productpage:9080', '10.00'),
    makeEdge('e1', 'n6', 'n0', 'productpage', 'productpage:9080', '10.00'),
    makeEdge('e2', 'n0', 'n7', 'details', 'details:9080', '5.00'),
    makeEdge('e3', 'n0', 'n8', 'reviews', 'reviews:9080', '10.00'),
    makeEdge('e4', 'n7', 'n1', 'details', 'details:9080', '5.00'),
    makeEdge('e5', 'n8', 'n2', 'reviews', 'reviews:9080', '3.33'),
    makeEdge('e6', 'n8', 'n3', 'reviews', 'reviews:9080', '3.33'),
    makeEdge('e7', 'n8', 'n4', 'reviews', 'reviews:9080', '3.34'),
    makeEdge('e8', 'n3', 'n9', 'ratings', 'ratings:9080', '3.33'),
    makeEdge('e9', 'n4', 'n9', 'ratings', 'ratings:9080', '3.34'),
    makeEdge('e10', 'n9', 'n5', 'ratings', 'ratings:9080', '6.67')
  );

  return { nodes, edges };
};
