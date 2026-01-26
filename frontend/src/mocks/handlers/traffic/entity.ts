// Entity-specific graph generators (app, service, workload)
import { createAppHealthData, createServiceHealthData } from './common';

interface GraphData {
  duration: number;
  elements: { edges: unknown[]; nodes: unknown[] };
  graphType: string;
  timestamp: number;
}

export const generateAppGraph = (clusterName: string, namespace: string, appName: string): GraphData => {
  return {
    timestamp: Math.floor(Date.now() / 1000),
    duration: 60,
    graphType: 'versionedApp',
    elements: {
      nodes: [
        // The main app node
        {
          data: {
            id: 'app-main',
            nodeType: 'app',
            cluster: clusterName,
            namespace: namespace,
            app: appName,
            version: 'v1',
            // Note: Don't set 'workload' field here - MiniGraphCard uses it to determine node type
            // and would incorrectly navigate to workload detail instead of staying on app detail
            traffic: [{ protocol: 'http', rates: { httpIn: '10.00', httpOut: '8.00' } }],
            healthData: createAppHealthData(`${appName}-v1`, namespace)
          }
        },
        // Inbound: istio-ingressgateway
        {
          data: {
            id: 'app-inbound-gateway',
            nodeType: 'workload',
            cluster: clusterName,
            namespace: 'istio-system',
            workload: 'istio-ingressgateway',
            app: 'istio-ingressgateway',
            isRoot: true,
            isGateway: { ingressInfo: { hostnames: ['*'] } },
            traffic: [{ protocol: 'http', rates: { httpOut: '10.00' } }]
          }
        },
        // Outbound: details service
        {
          data: {
            id: 'app-outbound-details',
            nodeType: 'service',
            cluster: clusterName,
            namespace: namespace,
            service: 'details',
            traffic: [{ protocol: 'http', rates: { httpIn: '3.00' } }]
          }
        },
        // Outbound: reviews service
        {
          data: {
            id: 'app-outbound-reviews',
            nodeType: 'service',
            cluster: clusterName,
            namespace: namespace,
            service: 'reviews',
            traffic: [{ protocol: 'http', rates: { httpIn: '5.00' } }]
          }
        }
      ],
      edges: [
        {
          data: {
            id: 'e-inbound-gateway',
            source: 'app-inbound-gateway',
            target: 'app-main',
            traffic: {
              protocol: 'http',
              rates: { http: '10.00', httpPercentReq: '100.0' },
              responses: { '200': { flags: { '-': '100.0' }, hosts: { [`${appName}:9080`]: '100.0' } } }
            }
          }
        },
        {
          data: {
            id: 'e-outbound-details',
            source: 'app-main',
            target: 'app-outbound-details',
            traffic: {
              protocol: 'http',
              rates: { http: '3.00', httpPercentReq: '37.5' },
              responses: { '200': { flags: { '-': '100.0' }, hosts: { 'details:9080': '100.0' } } }
            }
          }
        },
        {
          data: {
            id: 'e-outbound-reviews',
            source: 'app-main',
            target: 'app-outbound-reviews',
            traffic: {
              protocol: 'http',
              rates: { http: '5.00', httpPercentReq: '62.5' },
              responses: { '200': { flags: { '-': '100.0' }, hosts: { 'reviews:9080': '100.0' } } }
            }
          }
        }
      ]
    }
  };
};

export const generateServiceGraph = (clusterName: string, namespace: string, serviceName: string): GraphData => {
  return {
    timestamp: Math.floor(Date.now() / 1000),
    duration: 60,
    graphType: 'versionedApp',
    elements: {
      nodes: [
        // The main service node
        {
          data: {
            id: 'svc-main',
            nodeType: 'service',
            cluster: clusterName,
            namespace: namespace,
            service: serviceName,
            traffic: [{ protocol: 'http', rates: { httpIn: '10.00', httpOut: '10.00' } }],
            healthData: createServiceHealthData(serviceName, namespace)
          }
        },
        // Inbound: productpage app
        {
          data: {
            id: 'svc-inbound-productpage',
            nodeType: 'app',
            cluster: clusterName,
            namespace: namespace,
            app: 'productpage',
            version: 'v1',
            // Note: Don't set 'workload' field for app nodes - MiniGraphCard uses it to determine node type
            traffic: [{ protocol: 'http', rates: { httpOut: '10.00' } }],
            healthData: createAppHealthData('productpage-v1', namespace)
          }
        },
        // Outbound: workload backing the service
        {
          data: {
            id: 'svc-outbound-workload',
            nodeType: 'workload',
            cluster: clusterName,
            namespace: namespace,
            workload: `${serviceName}-v1`,
            app: serviceName,
            version: 'v1',
            traffic: [{ protocol: 'http', rates: { httpIn: '10.00' } }]
          }
        }
      ],
      edges: [
        {
          data: {
            id: 'e-inbound-productpage',
            source: 'svc-inbound-productpage',
            target: 'svc-main',
            traffic: {
              protocol: 'http',
              rates: { http: '10.00', httpPercentReq: '100.0' },
              responses: { '200': { flags: { '-': '100.0' }, hosts: { [`${serviceName}:9080`]: '100.0' } } }
            }
          }
        },
        {
          data: {
            id: 'e-outbound-workload',
            source: 'svc-main',
            target: 'svc-outbound-workload',
            traffic: {
              protocol: 'http',
              rates: { http: '10.00', httpPercentReq: '100.0' },
              responses: { '200': { flags: { '-': '100.0' }, hosts: { [`${serviceName}:9080`]: '100.0' } } }
            }
          }
        }
      ]
    }
  };
};

export const generateWorkloadGraph = (clusterName: string, namespace: string, workloadName: string): GraphData => {
  return {
    timestamp: Math.floor(Date.now() / 1000),
    duration: 60,
    graphType: 'workload',
    elements: {
      nodes: [
        // The main workload node
        {
          data: {
            id: 'wl-main',
            nodeType: 'workload',
            cluster: clusterName,
            namespace: namespace,
            workload: workloadName,
            app: workloadName.replace(/-v\d+$/, ''),
            version: workloadName.match(/-v(\d+)$/)?.[1] ? `v${workloadName.match(/-v(\d+)$/)?.[1]}` : 'v1',
            traffic: [{ protocol: 'http', rates: { httpIn: '10.00', httpOut: '8.00' } }],
            healthData: {
              workloadStatus: {
                name: workloadName,
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
          }
        },
        // Inbound: istio-ingressgateway
        {
          data: {
            id: 'wl-inbound-gateway',
            nodeType: 'workload',
            cluster: clusterName,
            namespace: 'istio-system',
            workload: 'istio-ingressgateway',
            app: 'istio-ingressgateway',
            isRoot: true,
            isGateway: {
              ingressInfo: { hostnames: ['*'] }
            },
            traffic: [{ protocol: 'http', rates: { httpOut: '10.00' } }]
          }
        },
        // Outbound: details service
        {
          data: {
            id: 'wl-outbound-details',
            nodeType: 'service',
            cluster: clusterName,
            namespace: namespace,
            service: 'details',
            traffic: [{ protocol: 'http', rates: { httpIn: '3.00' } }]
          }
        },
        // Outbound: reviews service
        {
          data: {
            id: 'wl-outbound-reviews',
            nodeType: 'service',
            cluster: clusterName,
            namespace: namespace,
            service: 'reviews',
            traffic: [{ protocol: 'http', rates: { httpIn: '5.00' } }]
          }
        }
      ],
      edges: [
        // Inbound edge from gateway
        {
          data: {
            id: 'e-inbound-gateway',
            source: 'wl-inbound-gateway',
            target: 'wl-main',
            traffic: {
              protocol: 'http',
              rates: { http: '10.00', httpPercentReq: '100.0' },
              responses: {
                '200': { flags: { '-': '100.0' }, hosts: { [`${workloadName}:9080`]: '100.0' } }
              }
            }
          }
        },
        // Outbound edge to details
        {
          data: {
            id: 'e-outbound-details',
            source: 'wl-main',
            target: 'wl-outbound-details',
            traffic: {
              protocol: 'http',
              rates: { http: '3.00', httpPercentReq: '37.5' },
              responses: {
                '200': { flags: { '-': '100.0' }, hosts: { 'details:9080': '100.0' } }
              }
            }
          }
        },
        // Outbound edge to reviews
        {
          data: {
            id: 'e-outbound-reviews',
            source: 'wl-main',
            target: 'wl-outbound-reviews',
            traffic: {
              protocol: 'http',
              rates: { http: '5.00', httpPercentReq: '62.5' },
              responses: {
                '200': { flags: { '-': '100.0' }, hosts: { 'reviews:9080': '100.0' } }
              }
            }
          }
        }
      ]
    }
  };
};
