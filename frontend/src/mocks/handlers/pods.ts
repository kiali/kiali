import { http, HttpResponse } from 'msw';
import { generateMockDashboard, generateMockMetrics } from './utils';

const envoyMockClusters = (namespace: string): Record<string, unknown>[] => [
  {
    service_fqdn: { cluster: 'cluster-default', namespace, service: 'details' },
    port: 9080,
    subset: '',
    direction: 'outbound',
    type: 'EDS',
    destination_rule: ''
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace, service: 'reviews' },
    port: 9080,
    subset: '',
    direction: 'outbound',
    type: 'EDS',
    destination_rule: ''
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace, service: 'ratings' },
    port: 9080,
    subset: '',
    direction: 'outbound',
    type: 'EDS',
    destination_rule: ''
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace, service: 'productpage' },
    port: 9080,
    subset: '',
    direction: 'inbound',
    type: 'ORIGINAL_DST',
    destination_rule: ''
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace, service: 'orders' },
    port: 8080,
    subset: '',
    direction: 'outbound',
    type: 'EDS',
    destination_rule: ''
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace, service: 'inventory' },
    port: 8080,
    subset: '',
    direction: 'outbound',
    type: 'EDS',
    destination_rule: ''
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace, service: 'shipping' },
    port: 9090,
    subset: '',
    direction: 'outbound',
    type: 'EDS',
    destination_rule: ''
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace, service: 'payment' },
    port: 8443,
    subset: 'v1',
    direction: 'outbound',
    type: 'EDS',
    destination_rule: `${namespace}/payment-dr`
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace, service: 'notifications' },
    port: 8080,
    subset: '',
    direction: 'outbound',
    type: 'EDS',
    destination_rule: ''
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace: 'istio-system', service: 'istiod' },
    port: 15012,
    subset: '',
    direction: 'outbound',
    type: 'EDS',
    destination_rule: ''
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace: 'istio-system', service: 'kiali' },
    port: 20001,
    subset: '',
    direction: 'outbound',
    type: 'EDS',
    destination_rule: ''
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace: 'istio-system', service: 'prometheus' },
    port: 9090,
    subset: '',
    direction: 'outbound',
    type: 'EDS',
    destination_rule: ''
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace: 'istio-system', service: 'grafana' },
    port: 3000,
    subset: '',
    direction: 'outbound',
    type: 'STRICT_DNS',
    destination_rule: ''
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace: 'default', service: 'kubernetes' },
    port: 443,
    subset: '',
    direction: 'outbound',
    type: 'ORIGINAL_DST',
    destination_rule: ''
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace, service: 'cache' },
    port: 6379,
    subset: '',
    direction: 'outbound',
    type: 'STRICT_DNS',
    destination_rule: ''
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace, service: 'queue' },
    port: 5672,
    subset: '',
    direction: 'outbound',
    type: 'EDS',
    destination_rule: ''
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace, service: 'search' },
    port: 9200,
    subset: '',
    direction: 'outbound',
    type: 'EDS',
    destination_rule: ''
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace, service: 'auth-service' },
    port: 8080,
    subset: 'v2',
    direction: 'outbound',
    type: 'EDS',
    destination_rule: `${namespace}/auth-dr`
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace, service: 'api-gateway' },
    port: 8080,
    subset: '',
    direction: 'inbound',
    type: 'ORIGINAL_DST',
    destination_rule: ''
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace, service: 'frontend' },
    port: 3000,
    subset: '',
    direction: 'outbound',
    type: 'EDS',
    destination_rule: ''
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace, service: 'metrics-collector' },
    port: 9090,
    subset: '',
    direction: 'outbound',
    type: 'STRICT_DNS',
    destination_rule: ''
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace, service: 'storage' },
    port: 8080,
    subset: '',
    direction: 'outbound',
    type: 'EDS',
    destination_rule: ''
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace, service: 'indexer' },
    port: 8080,
    subset: '',
    direction: 'outbound',
    type: 'EDS',
    destination_rule: `${namespace}/indexer-dr`
  },
  {
    service_fqdn: { cluster: 'cluster-default', namespace, service: 'logging' },
    port: 5601,
    subset: '',
    direction: 'outbound',
    type: 'STRICT_DNS',
    destination_rule: ''
  }
];

const envoyMockListeners = (): Record<string, unknown>[] => [
  { address: '0.0.0.0', port: 15006, match: 'ALL', destination: 'Inline Route: /*' },
  { address: '0.0.0.0', port: 15001, match: 'ALL', destination: 'Inline Route: /*' },
  {
    address: '10.96.0.1',
    port: 443,
    match: 'ALL',
    destination: 'Cluster: outbound|443||kubernetes.default.svc.cluster.local'
  },
  { address: '0.0.0.0', port: 9080, match: 'ALL', destination: 'Route: 9080' },
  { address: '0.0.0.0', port: 8080, match: 'ALL', destination: 'Route: 8080' },
  { address: '0.0.0.0', port: 9090, match: 'ALL', destination: 'Route: 9090' },
  { address: '0.0.0.0', port: 8443, match: 'Trans: tls', destination: 'Route: 8443' },
  { address: '0.0.0.0', port: 3000, match: 'ALL', destination: 'Route: 3000' },
  {
    address: '0.0.0.0',
    port: 6379,
    match: 'ALL',
    destination: 'Cluster: outbound|6379||cache.bookinfo.svc.cluster.local'
  },
  {
    address: '0.0.0.0',
    port: 5672,
    match: 'ALL',
    destination: 'Cluster: outbound|5672||queue.bookinfo.svc.cluster.local'
  },
  { address: '0.0.0.0', port: 9200, match: 'ALL', destination: 'Route: 9200' },
  {
    address: '0.0.0.0',
    port: 15012,
    match: 'Trans: tls',
    destination: 'Cluster: outbound|15012||istiod.istio-system.svc.cluster.local'
  },
  {
    address: '0.0.0.0',
    port: 20001,
    match: 'ALL',
    destination: 'Cluster: outbound|20001||kiali.istio-system.svc.cluster.local'
  },
  { address: '0.0.0.0', port: 5601, match: 'ALL', destination: 'Route: 5601' },
  {
    address: '10.96.10.1',
    port: 9080,
    match: 'ALL',
    destination: 'Cluster: outbound|9080||productpage.bookinfo.svc.cluster.local'
  },
  {
    address: '10.96.10.2',
    port: 9080,
    match: 'ALL',
    destination: 'Cluster: outbound|9080||reviews.bookinfo.svc.cluster.local'
  },
  {
    address: '10.96.10.3',
    port: 9080,
    match: 'ALL',
    destination: 'Cluster: outbound|9080||ratings.bookinfo.svc.cluster.local'
  },
  {
    address: '10.96.10.4',
    port: 9080,
    match: 'ALL',
    destination: 'Cluster: outbound|9080||details.bookinfo.svc.cluster.local'
  },
  {
    address: '10.96.10.5',
    port: 8080,
    match: 'ALL',
    destination: 'Cluster: outbound|8080||orders.bookinfo.svc.cluster.local'
  },
  {
    address: '10.96.10.6',
    port: 8080,
    match: 'ALL',
    destination: 'Cluster: outbound|8080||inventory.bookinfo.svc.cluster.local'
  },
  {
    address: '10.96.10.7',
    port: 9090,
    match: 'ALL',
    destination: 'Cluster: outbound|9090||shipping.bookinfo.svc.cluster.local'
  },
  {
    address: '10.96.10.8',
    port: 8443,
    match: 'Trans: tls',
    destination: 'Cluster: outbound|8443||payment.bookinfo.svc.cluster.local'
  },
  {
    address: '10.96.10.9',
    port: 8080,
    match: 'ALL',
    destination: 'Cluster: outbound|8080||notifications.bookinfo.svc.cluster.local'
  }
];

const envoyMockRoutes = (namespace: string): Record<string, unknown>[] => [
  {
    name: '9080',
    domains: { cluster: 'cluster-default', namespace, service: 'details' },
    match: '/*',
    virtual_service: ''
  },
  {
    name: '9080',
    domains: { cluster: 'cluster-default', namespace, service: 'reviews' },
    match: '/*',
    virtual_service: ''
  },
  {
    name: '9080',
    domains: { cluster: 'cluster-default', namespace, service: 'ratings' },
    match: '/*',
    virtual_service: ''
  },
  {
    name: '9080',
    domains: { cluster: 'cluster-default', namespace, service: 'productpage' },
    match: '/*',
    virtual_service: ''
  },
  {
    name: '8080',
    domains: { cluster: 'cluster-default', namespace, service: 'orders' },
    match: '/*',
    virtual_service: ''
  },
  {
    name: '8080',
    domains: { cluster: 'cluster-default', namespace, service: 'inventory' },
    match: '/*',
    virtual_service: ''
  },
  {
    name: '9090',
    domains: { cluster: 'cluster-default', namespace, service: 'shipping' },
    match: '/*',
    virtual_service: ''
  },
  {
    name: '8443',
    domains: { cluster: 'cluster-default', namespace, service: 'payment' },
    match: '/pay/*',
    virtual_service: `${namespace}/payment-vs`
  },
  {
    name: '8080',
    domains: { cluster: 'cluster-default', namespace, service: 'notifications' },
    match: '/*',
    virtual_service: ''
  },
  {
    name: '8080',
    domains: { cluster: 'cluster-default', namespace, service: 'auth-service' },
    match: '/auth/*',
    virtual_service: `${namespace}/auth-vs`
  },
  {
    name: '8080',
    domains: { cluster: 'cluster-default', namespace, service: 'api-gateway' },
    match: '/*',
    virtual_service: ''
  },
  {
    name: '3000',
    domains: { cluster: 'cluster-default', namespace, service: 'frontend' },
    match: '/*',
    virtual_service: ''
  },
  {
    name: '9090',
    domains: { cluster: 'cluster-default', namespace: 'istio-system', service: 'prometheus' },
    match: '/*',
    virtual_service: ''
  },
  {
    name: '3000',
    domains: { cluster: 'cluster-default', namespace: 'istio-system', service: 'grafana' },
    match: '/*',
    virtual_service: ''
  },
  {
    name: '9200',
    domains: { cluster: 'cluster-default', namespace, service: 'search' },
    match: '/*',
    virtual_service: ''
  },
  {
    name: '8080',
    domains: { cluster: 'cluster-default', namespace, service: 'storage' },
    match: '/*',
    virtual_service: ''
  },
  {
    name: '8080',
    domains: { cluster: 'cluster-default', namespace, service: 'indexer' },
    match: '/index/*',
    virtual_service: `${namespace}/indexer-vs`
  },
  {
    name: '5601',
    domains: { cluster: 'cluster-default', namespace, service: 'logging' },
    match: '/*',
    virtual_service: ''
  },
  {
    name: '20001',
    domains: { cluster: 'cluster-default', namespace: 'istio-system', service: 'kiali' },
    match: '/*',
    virtual_service: ''
  },
  {
    name: '9090',
    domains: { cluster: 'cluster-default', namespace, service: 'metrics-collector' },
    match: '/*',
    virtual_service: ''
  }
];

export const podHandlers = [
  http.get('*/api/namespaces/:namespace/pods/:pod/config_dump', ({ params }) => {
    const ns = params.namespace as string;
    return HttpResponse.json({
      bootstrap: {
        bootstrap: {
          node: {
            id: `sidecar~10.244.0.10~${params.pod}.${ns}~${ns}.svc.cluster.local`
          }
        }
      },
      clusters: envoyMockClusters(ns),
      listeners: envoyMockListeners(),
      routes: envoyMockRoutes(ns)
    });
  }),

  http.get('*/api/namespaces/:namespace/pods/:pod/config_dump/:resource', ({ params }) => {
    const { resource } = params;
    const ns = params.namespace as string;

    if (resource === 'clusters') {
      return HttpResponse.json({ clusters: envoyMockClusters(ns) });
    }

    if (resource === 'listeners') {
      return HttpResponse.json({ listeners: envoyMockListeners() });
    }

    if (resource === 'routes') {
      return HttpResponse.json({ routes: envoyMockRoutes(ns) });
    }

    if (resource === 'bootstrap') {
      return HttpResponse.json({
        bootstrap: {
          bootstrap: {
            node: {
              id: `sidecar~10.244.0.10~${params.pod}.${ns}~${ns}.svc.cluster.local`
            }
          }
        }
      });
    }

    return HttpResponse.json({});
  }),

  http.get('*/api/namespaces/:namespace/pods/:pod/config_dump_ztunnel', () => {
    return HttpResponse.json({
      services: [
        {
          name: 'productpage',
          namespace: 'bookinfo',
          hostname: 'productpage.bookinfo.svc.cluster.local',
          vips: ['10.96.10.1'],
          ports: { http: 9080 },
          endpoints: {
            'uid-productpage-v1': { workloadUid: 'uid-productpage-v1', status: 'Healthy', port: { http: 9080 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/bookinfo/sa/bookinfo-productpage'],
          ipFamilies: 'IPv4',
          waypoint: { destination: '', hboneMtlsPort: 0 }
        },
        {
          name: 'reviews',
          namespace: 'bookinfo',
          hostname: 'reviews.bookinfo.svc.cluster.local',
          vips: ['10.96.10.2'],
          ports: { http: 9080 },
          endpoints: {
            'uid-reviews-v1': { workloadUid: 'uid-reviews-v1', status: 'Healthy', port: { http: 9080 } },
            'uid-reviews-v2': { workloadUid: 'uid-reviews-v2', status: 'Healthy', port: { http: 9080 } },
            'uid-reviews-v3': { workloadUid: 'uid-reviews-v3', status: 'Healthy', port: { http: 9080 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/bookinfo/sa/bookinfo-reviews'],
          ipFamilies: 'IPv4',
          waypoint: { destination: 'waypoint.istio-system.svc.cluster.local', hboneMtlsPort: 15008 }
        },
        {
          name: 'ratings',
          namespace: 'bookinfo',
          hostname: 'ratings.bookinfo.svc.cluster.local',
          vips: ['10.96.10.3'],
          ports: { http: 9080 },
          endpoints: {
            'uid-ratings-v1': { workloadUid: 'uid-ratings-v1', status: 'Healthy', port: { http: 9080 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/bookinfo/sa/bookinfo-ratings'],
          ipFamilies: 'IPv4',
          waypoint: { destination: '', hboneMtlsPort: 0 }
        },
        {
          name: 'details',
          namespace: 'bookinfo',
          hostname: 'details.bookinfo.svc.cluster.local',
          vips: ['10.96.10.4'],
          ports: { http: 9080 },
          endpoints: {
            'uid-details-v1': { workloadUid: 'uid-details-v1', status: 'Healthy', port: { http: 9080 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/bookinfo/sa/bookinfo-details'],
          ipFamilies: 'IPv4',
          waypoint: { destination: '', hboneMtlsPort: 0 }
        },
        {
          name: 'orders',
          namespace: 'bookinfo',
          hostname: 'orders.bookinfo.svc.cluster.local',
          vips: ['10.96.10.5'],
          ports: { http: 8080 },
          endpoints: {
            'uid-orders-v1': { workloadUid: 'uid-orders-v1', status: 'Healthy', port: { http: 8080 } },
            'uid-orders-v2': { workloadUid: 'uid-orders-v2', status: 'Healthy', port: { http: 8080 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/bookinfo/sa/bookinfo-orders'],
          ipFamilies: 'IPv4',
          waypoint: { destination: 'waypoint.istio-system.svc.cluster.local', hboneMtlsPort: 15008 }
        },
        {
          name: 'inventory',
          namespace: 'bookinfo',
          hostname: 'inventory.bookinfo.svc.cluster.local',
          vips: ['10.96.10.6'],
          ports: { http: 8080 },
          endpoints: {
            'uid-inventory-v1': { workloadUid: 'uid-inventory-v1', status: 'Healthy', port: { http: 8080 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/bookinfo/sa/bookinfo-inventory'],
          ipFamilies: 'IPv4',
          waypoint: { destination: '', hboneMtlsPort: 0 }
        },
        {
          name: 'shipping',
          namespace: 'bookinfo',
          hostname: 'shipping.bookinfo.svc.cluster.local',
          vips: ['10.96.10.7'],
          ports: { grpc: 9090 },
          endpoints: {
            'uid-shipping-v1': { workloadUid: 'uid-shipping-v1', status: 'Healthy', port: { grpc: 9090 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/bookinfo/sa/bookinfo-shipping'],
          ipFamilies: 'IPv4',
          waypoint: { destination: '', hboneMtlsPort: 0 }
        },
        {
          name: 'payment',
          namespace: 'bookinfo',
          hostname: 'payment.bookinfo.svc.cluster.local',
          vips: ['10.96.10.8'],
          ports: { https: 8443 },
          endpoints: {
            'uid-payment-v1': { workloadUid: 'uid-payment-v1', status: 'Healthy', port: { https: 8443 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/bookinfo/sa/bookinfo-payment'],
          ipFamilies: 'IPv4',
          waypoint: { destination: 'waypoint.istio-system.svc.cluster.local', hboneMtlsPort: 15008 }
        },
        {
          name: 'notifications',
          namespace: 'bookinfo',
          hostname: 'notifications.bookinfo.svc.cluster.local',
          vips: ['10.96.10.9'],
          ports: { http: 8080 },
          endpoints: {
            'uid-notifications-v1': { workloadUid: 'uid-notifications-v1', status: 'Healthy', port: { http: 8080 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/bookinfo/sa/bookinfo-notifications'],
          ipFamilies: 'IPv4',
          waypoint: { destination: '', hboneMtlsPort: 0 }
        },
        {
          name: 'frontend',
          namespace: 'alpha',
          hostname: 'frontend.alpha.svc.cluster.local',
          vips: ['10.96.20.1'],
          ports: { http: 3000 },
          endpoints: {
            'uid-frontend-v1': { workloadUid: 'uid-frontend-v1', status: 'Healthy', port: { http: 3000 } },
            'uid-frontend-v2': { workloadUid: 'uid-frontend-v2', status: 'Healthy', port: { http: 3000 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/alpha/sa/alpha-frontend'],
          ipFamilies: 'IPv4',
          waypoint: { destination: '', hboneMtlsPort: 0 }
        },
        {
          name: 'api-gateway',
          namespace: 'alpha',
          hostname: 'api-gateway.alpha.svc.cluster.local',
          vips: ['10.96.20.2'],
          ports: { http: 8080, grpc: 9090 },
          endpoints: {
            'uid-api-gateway-v1': { workloadUid: 'uid-api-gateway-v1', status: 'Healthy', port: { http: 8080 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/alpha/sa/alpha-api-gateway'],
          ipFamilies: 'IPv4',
          waypoint: { destination: 'waypoint.alpha.svc.cluster.local', hboneMtlsPort: 15008 }
        },
        {
          name: 'auth-service',
          namespace: 'alpha',
          hostname: 'auth-service.alpha.svc.cluster.local',
          vips: ['10.96.20.3'],
          ports: { http: 8080 },
          endpoints: {
            'uid-auth-service-v1': { workloadUid: 'uid-auth-service-v1', status: 'Healthy', port: { http: 8080 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/alpha/sa/alpha-auth-service'],
          ipFamilies: 'IPv4',
          waypoint: { destination: 'waypoint.alpha.svc.cluster.local', hboneMtlsPort: 15008 }
        },
        {
          name: 'cache',
          namespace: 'alpha',
          hostname: 'cache.alpha.svc.cluster.local',
          vips: ['10.96.20.4'],
          ports: { redis: 6379 },
          endpoints: {
            'uid-cache-v1': { workloadUid: 'uid-cache-v1', status: 'Healthy', port: { redis: 6379 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/alpha/sa/alpha-cache'],
          ipFamilies: 'IPv4',
          waypoint: { destination: '', hboneMtlsPort: 0 }
        },
        {
          name: 'search',
          namespace: 'beta',
          hostname: 'search.beta.svc.cluster.local',
          vips: ['10.96.30.1'],
          ports: { http: 9200 },
          endpoints: {
            'uid-search-v1': { workloadUid: 'uid-search-v1', status: 'Healthy', port: { http: 9200 } },
            'uid-search-v2': { workloadUid: 'uid-search-v2', status: 'Healthy', port: { http: 9200 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/beta/sa/beta-search'],
          ipFamilies: 'IPv4',
          waypoint: { destination: '', hboneMtlsPort: 0 }
        },
        {
          name: 'indexer',
          namespace: 'beta',
          hostname: 'indexer.beta.svc.cluster.local',
          vips: ['10.96.30.2'],
          ports: { http: 8080 },
          endpoints: {
            'uid-indexer-v1': { workloadUid: 'uid-indexer-v1', status: 'Healthy', port: { http: 8080 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/beta/sa/beta-indexer'],
          ipFamilies: 'IPv4',
          waypoint: { destination: '', hboneMtlsPort: 0 }
        },
        {
          name: 'metrics-collector',
          namespace: 'beta',
          hostname: 'metrics-collector.beta.svc.cluster.local',
          vips: ['10.96.30.3'],
          ports: { http: 9090 },
          endpoints: {
            'uid-metrics-collector-v1': {
              workloadUid: 'uid-metrics-collector-v1',
              status: 'Healthy',
              port: { http: 9090 }
            }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/beta/sa/beta-metrics-collector'],
          ipFamilies: 'IPv4',
          waypoint: { destination: '', hboneMtlsPort: 0 }
        },
        {
          name: 'queue-worker',
          namespace: 'beta',
          hostname: 'queue-worker.beta.svc.cluster.local',
          vips: ['10.96.30.4'],
          ports: { amqp: 5672 },
          endpoints: {
            'uid-queue-worker-v1': { workloadUid: 'uid-queue-worker-v1', status: 'Healthy', port: { amqp: 5672 } },
            'uid-queue-worker-v2': { workloadUid: 'uid-queue-worker-v2', status: 'Healthy', port: { amqp: 5672 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/beta/sa/beta-queue-worker'],
          ipFamilies: 'IPv4',
          waypoint: { destination: 'waypoint.beta.svc.cluster.local', hboneMtlsPort: 15008 }
        },
        {
          name: 'storage',
          namespace: 'beta',
          hostname: 'storage.beta.svc.cluster.local',
          vips: ['10.96.30.5'],
          ports: { http: 8080 },
          endpoints: {
            'uid-storage-v1': { workloadUid: 'uid-storage-v1', status: 'Healthy', port: { http: 8080 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/beta/sa/beta-storage'],
          ipFamilies: 'IPv4',
          waypoint: { destination: '', hboneMtlsPort: 0 }
        },
        {
          name: 'istiod',
          namespace: 'istio-system',
          hostname: 'istiod.istio-system.svc.cluster.local',
          vips: ['10.96.0.10'],
          ports: { grpc: 15010, https: 15012 },
          endpoints: {
            'uid-istiod-v1': { workloadUid: 'uid-istiod-v1', status: 'Healthy', port: { grpc: 15010 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/istio-system/sa/istiod'],
          ipFamilies: 'IPv4',
          waypoint: { destination: '', hboneMtlsPort: 0 }
        },
        {
          name: 'kiali',
          namespace: 'istio-system',
          hostname: 'kiali.istio-system.svc.cluster.local',
          vips: ['10.96.0.20'],
          ports: { http: 20001 },
          endpoints: {
            'uid-kiali-v1': { workloadUid: 'uid-kiali-v1', status: 'Healthy', port: { http: 20001 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/istio-system/sa/kiali'],
          ipFamilies: 'IPv4',
          waypoint: { destination: '', hboneMtlsPort: 0 }
        },
        {
          name: 'prometheus',
          namespace: 'istio-system',
          hostname: 'prometheus.istio-system.svc.cluster.local',
          vips: ['10.96.0.30'],
          ports: { http: 9090 },
          endpoints: {
            'uid-prometheus-v1': { workloadUid: 'uid-prometheus-v1', status: 'Healthy', port: { http: 9090 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/istio-system/sa/prometheus'],
          ipFamilies: 'IPv4',
          waypoint: { destination: '', hboneMtlsPort: 0 }
        },
        {
          name: 'grafana',
          namespace: 'istio-system',
          hostname: 'grafana.istio-system.svc.cluster.local',
          vips: ['10.96.0.40'],
          ports: { http: 3000 },
          endpoints: {
            'uid-grafana-v1': { workloadUid: 'uid-grafana-v1', status: 'Healthy', port: { http: 3000 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/istio-system/sa/grafana'],
          ipFamilies: 'IPv4',
          waypoint: { destination: '', hboneMtlsPort: 0 }
        },
        {
          name: 'kubernetes',
          namespace: 'default',
          hostname: 'kubernetes.default.svc.cluster.local',
          vips: ['10.96.0.1'],
          ports: { https: 443 },
          endpoints: {
            'uid-kubernetes-v1': { workloadUid: 'uid-kubernetes-v1', status: 'Healthy', port: { https: 443 } }
          },
          subjectAltNames: ['spiffe://cluster.local/ns/default/sa/default'],
          ipFamilies: 'IPv4',
          waypoint: { destination: '', hboneMtlsPort: 0 }
        }
      ],
      workloads: [
        {
          name: 'productpage-v1-abc123',
          namespace: 'bookinfo',
          workloadName: 'productpage-v1',
          workloadType: 'deployment',
          canonicalName: 'productpage',
          canonicalRevision: 'v1',
          node: 'node-1',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'bookinfo-productpage',
          uid: 'uid-productpage-v1',
          workloadIps: ['10.244.0.10'],
          services: ['bookinfo/productpage']
        },
        {
          name: 'reviews-v1-def456',
          namespace: 'bookinfo',
          workloadName: 'reviews-v1',
          workloadType: 'deployment',
          canonicalName: 'reviews',
          canonicalRevision: 'v1',
          node: 'node-1',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'bookinfo-reviews',
          uid: 'uid-reviews-v1',
          workloadIps: ['10.244.0.11'],
          services: ['bookinfo/reviews']
        },
        {
          name: 'reviews-v2-jkl012',
          namespace: 'bookinfo',
          workloadName: 'reviews-v2',
          workloadType: 'deployment',
          canonicalName: 'reviews',
          canonicalRevision: 'v2',
          node: 'node-2',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'bookinfo-reviews',
          uid: 'uid-reviews-v2',
          workloadIps: ['10.244.1.11'],
          services: ['bookinfo/reviews']
        },
        {
          name: 'reviews-v3-mno345',
          namespace: 'bookinfo',
          workloadName: 'reviews-v3',
          workloadType: 'deployment',
          canonicalName: 'reviews',
          canonicalRevision: 'v3',
          node: 'node-1',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'bookinfo-reviews',
          uid: 'uid-reviews-v3',
          workloadIps: ['10.244.0.12'],
          services: ['bookinfo/reviews']
        },
        {
          name: 'ratings-v1-ghi789',
          namespace: 'bookinfo',
          workloadName: 'ratings-v1',
          workloadType: 'deployment',
          canonicalName: 'ratings',
          canonicalRevision: 'v1',
          node: 'node-2',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'bookinfo-ratings',
          uid: 'uid-ratings-v1',
          workloadIps: ['10.244.1.10'],
          services: ['bookinfo/ratings']
        },
        {
          name: 'details-v1-pqr678',
          namespace: 'bookinfo',
          workloadName: 'details-v1',
          workloadType: 'deployment',
          canonicalName: 'details',
          canonicalRevision: 'v1',
          node: 'node-1',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'bookinfo-details',
          uid: 'uid-details-v1',
          workloadIps: ['10.244.0.13'],
          services: ['bookinfo/details']
        },
        {
          name: 'orders-v1-stu901',
          namespace: 'bookinfo',
          workloadName: 'orders-v1',
          workloadType: 'deployment',
          canonicalName: 'orders',
          canonicalRevision: 'v1',
          node: 'node-2',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'bookinfo-orders',
          uid: 'uid-orders-v1',
          workloadIps: ['10.244.1.12'],
          services: ['bookinfo/orders']
        },
        {
          name: 'orders-v2-vwx234',
          namespace: 'bookinfo',
          workloadName: 'orders-v2',
          workloadType: 'deployment',
          canonicalName: 'orders',
          canonicalRevision: 'v2',
          node: 'node-1',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'bookinfo-orders',
          uid: 'uid-orders-v2',
          workloadIps: ['10.244.0.14'],
          services: ['bookinfo/orders']
        },
        {
          name: 'inventory-v1-yza567',
          namespace: 'bookinfo',
          workloadName: 'inventory-v1',
          workloadType: 'deployment',
          canonicalName: 'inventory',
          canonicalRevision: 'v1',
          node: 'node-2',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'bookinfo-inventory',
          uid: 'uid-inventory-v1',
          workloadIps: ['10.244.1.13'],
          services: ['bookinfo/inventory']
        },
        {
          name: 'shipping-v1-bcd890',
          namespace: 'bookinfo',
          workloadName: 'shipping-v1',
          workloadType: 'deployment',
          canonicalName: 'shipping',
          canonicalRevision: 'v1',
          node: 'node-1',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'bookinfo-shipping',
          uid: 'uid-shipping-v1',
          workloadIps: ['10.244.0.15'],
          services: ['bookinfo/shipping']
        },
        {
          name: 'payment-v1-efg123',
          namespace: 'bookinfo',
          workloadName: 'payment-v1',
          workloadType: 'deployment',
          canonicalName: 'payment',
          canonicalRevision: 'v1',
          node: 'node-2',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'bookinfo-payment',
          uid: 'uid-payment-v1',
          workloadIps: ['10.244.1.14'],
          services: ['bookinfo/payment']
        },
        {
          name: 'notifications-v1-hij456',
          namespace: 'bookinfo',
          workloadName: 'notifications-v1',
          workloadType: 'deployment',
          canonicalName: 'notifications',
          canonicalRevision: 'v1',
          node: 'node-1',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'bookinfo-notifications',
          uid: 'uid-notifications-v1',
          workloadIps: ['10.244.0.16'],
          services: ['bookinfo/notifications']
        },
        {
          name: 'frontend-v1-klm789',
          namespace: 'alpha',
          workloadName: 'frontend-v1',
          workloadType: 'deployment',
          canonicalName: 'frontend',
          canonicalRevision: 'v1',
          node: 'node-1',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'alpha-frontend',
          uid: 'uid-frontend-v1',
          workloadIps: ['10.244.0.20'],
          services: ['alpha/frontend']
        },
        {
          name: 'frontend-v2-nop012',
          namespace: 'alpha',
          workloadName: 'frontend-v2',
          workloadType: 'deployment',
          canonicalName: 'frontend',
          canonicalRevision: 'v2',
          node: 'node-2',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'alpha-frontend',
          uid: 'uid-frontend-v2',
          workloadIps: ['10.244.1.20'],
          services: ['alpha/frontend']
        },
        {
          name: 'api-gateway-v1-qrs345',
          namespace: 'alpha',
          workloadName: 'api-gateway-v1',
          workloadType: 'deployment',
          canonicalName: 'api-gateway',
          canonicalRevision: 'v1',
          node: 'node-1',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'alpha-api-gateway',
          uid: 'uid-api-gateway-v1',
          workloadIps: ['10.244.0.21'],
          services: ['alpha/api-gateway']
        },
        {
          name: 'auth-service-v1-tuv678',
          namespace: 'alpha',
          workloadName: 'auth-service-v1',
          workloadType: 'deployment',
          canonicalName: 'auth-service',
          canonicalRevision: 'v1',
          node: 'node-2',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'alpha-auth-service',
          uid: 'uid-auth-service-v1',
          workloadIps: ['10.244.1.21'],
          services: ['alpha/auth-service']
        },
        {
          name: 'cache-v1-wxy901',
          namespace: 'alpha',
          workloadName: 'cache-v1',
          workloadType: 'statefulset',
          canonicalName: 'cache',
          canonicalRevision: 'v1',
          node: 'node-1',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'alpha-cache',
          uid: 'uid-cache-v1',
          workloadIps: ['10.244.0.22'],
          services: ['alpha/cache']
        },
        {
          name: 'search-v1-zab234',
          namespace: 'beta',
          workloadName: 'search-v1',
          workloadType: 'deployment',
          canonicalName: 'search',
          canonicalRevision: 'v1',
          node: 'node-2',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'beta-search',
          uid: 'uid-search-v1',
          workloadIps: ['10.244.1.30'],
          services: ['beta/search']
        },
        {
          name: 'search-v2-cde567',
          namespace: 'beta',
          workloadName: 'search-v2',
          workloadType: 'deployment',
          canonicalName: 'search',
          canonicalRevision: 'v2',
          node: 'node-1',
          status: 'Unhealthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'beta-search',
          uid: 'uid-search-v2',
          workloadIps: ['10.244.0.30'],
          services: ['beta/search']
        },
        {
          name: 'indexer-v1-fgh890',
          namespace: 'beta',
          workloadName: 'indexer-v1',
          workloadType: 'deployment',
          canonicalName: 'indexer',
          canonicalRevision: 'v1',
          node: 'node-2',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'beta-indexer',
          uid: 'uid-indexer-v1',
          workloadIps: ['10.244.1.31'],
          services: ['beta/indexer']
        },
        {
          name: 'metrics-collector-v1-ijk123',
          namespace: 'beta',
          workloadName: 'metrics-collector-v1',
          workloadType: 'daemonset',
          canonicalName: 'metrics-collector',
          canonicalRevision: 'v1',
          node: 'node-1',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'beta-metrics-collector',
          uid: 'uid-metrics-collector-v1',
          workloadIps: ['10.244.0.31'],
          services: ['beta/metrics-collector']
        },
        {
          name: 'queue-worker-v1-lmn456',
          namespace: 'beta',
          workloadName: 'queue-worker-v1',
          workloadType: 'deployment',
          canonicalName: 'queue-worker',
          canonicalRevision: 'v1',
          node: 'node-2',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'beta-queue-worker',
          uid: 'uid-queue-worker-v1',
          workloadIps: ['10.244.1.32'],
          services: ['beta/queue-worker'],
          waypoint: { destination: 'waypoint.beta.svc.cluster.local', hboneMtlsPort: 15008 }
        },
        {
          name: 'queue-worker-v2-opq789',
          namespace: 'beta',
          workloadName: 'queue-worker-v2',
          workloadType: 'deployment',
          canonicalName: 'queue-worker',
          canonicalRevision: 'v2',
          node: 'node-1',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'beta-queue-worker',
          uid: 'uid-queue-worker-v2',
          workloadIps: ['10.244.0.32'],
          services: ['beta/queue-worker'],
          waypoint: { destination: 'waypoint.beta.svc.cluster.local', hboneMtlsPort: 15008 }
        },
        {
          name: 'storage-v1-rst012',
          namespace: 'beta',
          workloadName: 'storage-v1',
          workloadType: 'statefulset',
          canonicalName: 'storage',
          canonicalRevision: 'v1',
          node: 'node-2',
          status: 'Healthy',
          protocol: 'HBONE',
          networkMode: 'ztunnel',
          clusterId: 'Kubernetes',
          trustDomain: 'cluster.local',
          serviceAccount: 'beta-storage',
          uid: 'uid-storage-v1',
          workloadIps: ['10.244.1.33'],
          services: ['beta/storage']
        }
      ],
      policies: [],
      certificates: [
        {
          identity: 'spiffe://cluster.local/ns/bookinfo/sa/bookinfo-productpage',
          state: 'Available',
          certChain: [
            {
              validFrom: new Date(Date.now() - 86400000).toISOString(),
              expirationTime: new Date(Date.now() + 86400000 * 30).toISOString(),
              serialNumber: 'a1b2c3d4e5f6',
              pem: '-----BEGIN CERTIFICATE-----\nMIIC...(truncated)\n-----END CERTIFICATE-----'
            }
          ]
        }
      ]
    });
  }),

  http.get('*/api/namespaces/:namespace/pods/:pod/logging', () => {
    return HttpResponse.json({
      loggers: {
        'envoy.http': 'warning',
        'envoy.upstream': 'warning',
        'envoy.connection': 'warning'
      }
    });
  }),

  http.get('*/api/namespaces/:namespace/pods/:pod/logs', ({ request }) => {
    const url = new URL(request.url);
    const logType = url.searchParams.get('logType') || 'app';
    const baseTime = Math.floor(Date.now() / 1000) - 300;

    const appMessages = [
      'Starting application server on port 9080',
      'Connected to database cluster at mongodb:27017',
      'Health check endpoint /health registered',
      'Loading product catalog from cache',
      '{"level":"info","ts":1719500000.123,"caller":"server/main.go:42","msg":"Received request","method":"GET","path":"/api/v1/products","remote_addr":"10.244.0.1:47832","latency_ms":23,"status":200}',
      'Cache miss for key product:42, fetching from DB',
      'Successfully retrieved 15 products in 23ms',
      '{"level":"warn","ts":1719500015.456,"caller":"db/query.go:118","msg":"Slow query detected","query":"SELECT * FROM reviews WHERE product_id=42","duration_ms":250,"rows_scanned":15000,"rows_returned":3}',
      'Upstream service ratings:9080 responded in 12ms',
      'Received request for /api/v1/details?isbn=0123456789',
      'Connection pool stats: active=3 idle=7 max=10',
      'Slow query detected: SELECT * FROM reviews WHERE product_id=42 took 250ms',
      'Retry attempt 1/3 for upstream service ratings',
      '{"level":"error","ts":1719500045.789,"caller":"circuit/breaker.go:67","msg":"Circuit breaker tripped","service":"ratings","consecutive_failures":5,"state":"OPEN","half_open_after":"30s","last_error":"connection refused"}',
      'Request /api/v1/products completed in 145ms',
      'GC pause: 12ms (young generation)',
      'Received SIGTERM, starting graceful shutdown',
      'Draining connections, 3 active requests remaining',
      'All connections drained, shutting down',
      'Application server stopped'
    ];

    const severities = [
      'INFO',
      'INFO',
      'INFO',
      'INFO',
      'INFO',
      'INFO',
      'INFO',
      'WARN',
      'INFO',
      'INFO',
      'INFO',
      'WARN',
      'WARN',
      'ERROR',
      'INFO',
      'INFO',
      'INFO',
      'INFO',
      'INFO',
      'INFO'
    ];

    const proxyAccessLog = {
      authority: 'productpage:9080',
      bytes_received: '0',
      bytes_sent: '5765',
      downstream_local: '10.244.0.15:9080',
      downstream_remote: '10.244.0.1:47832',
      duration: '23',
      forwarded_for: '-',
      method: 'GET',
      protocol: 'HTTP/1.1',
      request_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      requested_server: '-',
      response_flags: '-',
      route_name: 'default',
      status_code: '200',
      tcp_service_time: '-',
      timestamp: new Date((baseTime + 120) * 1000).toISOString(),
      upstream_cluster: 'inbound|9080||',
      upstream_failure_reason: '-',
      upstream_local: '127.0.0.6:46543',
      upstream_service: '10.244.0.15:9080',
      upstream_service_time: '22',
      uri_param: '-',
      uri_path: '/api/v1/products',
      user_agent: 'Mozilla/5.0 (compatible; istio-probe/1.0)'
    };

    const proxyAccessLog503 = {
      ...proxyAccessLog,
      status_code: '503',
      duration: '5001',
      response_flags: 'UF',
      upstream_failure_reason: 'connection_termination',
      bytes_sent: '91',
      uri_path: '/api/v1/ratings',
      request_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
    };

    const entries =
      logType === 'proxy'
        ? [
            ...[
              'GET /api/v1/products HTTP/1.1 200 5765 23ms',
              'GET /api/v1/reviews?product=42 HTTP/1.1 200 1234 12ms',
              'GET /healthz/ready HTTP/1.1 200 0 1ms',
              'GET /api/v1/details?isbn=0123456789 HTTP/1.1 200 890 8ms',
              'GET /api/v1/ratings HTTP/1.1 503 91 5001ms',
              'GET /api/v1/products HTTP/1.1 200 5780 19ms',
              'GET /healthz/ready HTTP/1.1 200 0 0ms',
              'POST /api/v1/reviews HTTP/1.1 201 234 45ms',
              'GET /api/v1/products?page=2 HTTP/1.1 200 5102 21ms',
              'GET /stats/prometheus HTTP/1.1 200 12456 3ms'
            ].map((msg, i) => ({
              message: `[${new Date((baseTime + i * 15) * 1000).toISOString()}] "${msg}"`,
              severity: msg.includes('503') ? 'ERROR' : 'INFO',
              timestamp: new Date((baseTime + i * 15) * 1000).toISOString(),
              timestampUnix: baseTime + i * 15,
              accessLog: i === 4 ? proxyAccessLog503 : i % 3 === 0 ? proxyAccessLog : undefined
            }))
          ]
        : appMessages.map((msg, i) => {
            const isJsonMsg = msg.startsWith('{');
            return {
              message: isJsonMsg ? msg : `[${new Date((baseTime + i * 15) * 1000).toISOString()}] ${msg}`,
              severity: severities[i],
              timestamp: new Date((baseTime + i * 15) * 1000).toISOString(),
              timestampUnix: baseTime + i * 15
            };
          });

    return HttpResponse.json({ entries, linesTruncated: false });
  }),

  http.get('*/api/namespaces/:namespace/customdashboard/:template', ({ params, request }) => {
    const { template } = params;
    const url = new URL(request.url);
    const direction = url.searchParams.get('direction') || 'inbound';
    return HttpResponse.json(generateMockDashboard(String(template), direction));
  }),

  http.get('*/api/namespaces/:namespace/ztunnel/:controlPlane/dashboard', ({ request }) => {
    const url = new URL(request.url);
    const direction = url.searchParams.get('direction') || 'inbound';
    return HttpResponse.json(generateMockDashboard('Ztunnel', direction));
  }),

  http.get('*/api/clusters/metrics', () => {
    return HttpResponse.json(generateMockMetrics('inbound'));
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

  http.post('*/api/stats/metrics', async ({ request }) => {
    const body = (await request.json()) as {
      queries: Array<{
        direction: string;
        interval: string;
        target: { kind: string; name: string; namespace: string };
      }>;
    };
    const stats: Record<string, { isCompact: boolean; responseTimes: Array<{ name: string; value: number }> }> = {};

    if (body.queries) {
      body.queries.forEach(query => {
        const { target, direction, interval } = query;
        const key = `${target.namespace}:${target.kind}:${target.name}::${direction}:${interval}`;

        const baseLatency = 20 + Math.random() * 30;
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
