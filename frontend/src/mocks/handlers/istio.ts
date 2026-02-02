import { http, HttpResponse } from 'msw';
import {
  getAllControlPlanes,
  getClusterHealthStatus,
  getClusterValidationCounts,
  getScenarioConfig
} from '../scenarios';
import { ComponentStatus, Status } from '../../types/IstioStatus';

// Map cluster health status to Istio component status
const healthToStatus = (health: 'Healthy' | 'Degraded' | 'Unhealthy'): Status => {
  switch (health) {
    case 'Unhealthy':
      return Status.Unhealthy;
    case 'Degraded':
      return Status.Unhealthy; // Degraded maps to unhealthy for components
    default:
      return Status.Healthy;
  }
};

// Generate Istio status for all clusters in the scenario
const generateIstioStatus = (): ComponentStatus[] => {
  const scenarioConfig = getScenarioConfig();
  const statuses: ComponentStatus[] = [];

  scenarioConfig.clusters.forEach(cluster => {
    const clusterHealth = getClusterHealthStatus(cluster.name);
    const componentStatus = healthToStatus(clusterHealth);

    // Get control planes for this cluster
    const controlPlanes = cluster.controlPlanes || [
      { istiodName: 'istiod', istiodNamespace: 'istio-system', revision: 'default', status: clusterHealth }
    ];

    // Add each control plane as a component
    controlPlanes.forEach(cp => {
      const cpStatus = healthToStatus(cp.status);
      statuses.push({
        name: cp.istiodName,
        cluster: cluster.name,
        status: cpStatus,
        isCore: true
      });
    });

    // ingress gateway - core component (follows cluster health)
    statuses.push({
      name: 'istio-ingressgateway',
      cluster: cluster.name,
      status: componentStatus,
      isCore: true
    });

    // egress gateway - addon (non-core, usually healthy)
    statuses.push({
      name: 'istio-egressgateway',
      cluster: cluster.name,
      status: Status.Healthy,
      isCore: false
    });

    // Prometheus - addon (degraded clusters might have prometheus issues)
    statuses.push({
      name: 'prometheus',
      cluster: cluster.name,
      status: clusterHealth === 'Unhealthy' ? Status.Unhealthy : Status.Healthy,
      isCore: false
    });

    // Grafana - addon
    statuses.push({
      name: 'grafana',
      cluster: cluster.name,
      status: Status.Healthy,
      isCore: false
    });
  });

  return statuses;
};

// Helper to create mock Istio object metadata
const createIstioMetadata = (name: string, namespace: string): Record<string, unknown> => ({
  name,
  namespace,
  creationTimestamp: new Date().toISOString(),
  resourceVersion: '12345',
  uid: `${name}-${namespace}-uid`,
  labels: {
    app: name.replace('-vs', '').replace('-dr', '')
  }
});

// Mock VirtualServices
const mockVirtualServices = [
  {
    apiVersion: 'networking.istio.io/v1',
    kind: 'VirtualService',
    metadata: createIstioMetadata('bookinfo-vs', 'bookinfo'),
    spec: {
      hosts: ['productpage'],
      http: [
        {
          match: [{ uri: { exact: '/productpage' } }],
          route: [{ destination: { host: 'productpage', port: { number: 9080 } } }]
        }
      ]
    }
  },
  {
    apiVersion: 'networking.istio.io/v1',
    kind: 'VirtualService',
    metadata: createIstioMetadata('reviews-vs', 'bookinfo'),
    spec: {
      hosts: ['reviews'],
      http: [
        {
          route: [
            { destination: { host: 'reviews', subset: 'v1' }, weight: 50 },
            { destination: { host: 'reviews', subset: 'v2' }, weight: 25 },
            { destination: { host: 'reviews', subset: 'v3' }, weight: 25 }
          ]
        }
      ]
    }
  }
];

// Mock DestinationRules
const mockDestinationRules = [
  {
    apiVersion: 'networking.istio.io/v1',
    kind: 'DestinationRule',
    metadata: createIstioMetadata('productpage-dr', 'bookinfo'),
    spec: {
      host: 'productpage',
      trafficPolicy: {
        connectionPool: {
          tcp: { maxConnections: 100 },
          http: { h2UpgradePolicy: 'UPGRADE' }
        }
      }
    }
  },
  {
    apiVersion: 'networking.istio.io/v1',
    kind: 'DestinationRule',
    metadata: createIstioMetadata('reviews-dr', 'bookinfo'),
    spec: {
      host: 'reviews',
      subsets: [
        { name: 'v1', labels: { version: 'v1' } },
        { name: 'v2', labels: { version: 'v2' } },
        { name: 'v3', labels: { version: 'v3' } }
      ]
    }
  },
  {
    apiVersion: 'networking.istio.io/v1',
    kind: 'DestinationRule',
    metadata: createIstioMetadata('ratings-dr', 'bookinfo'),
    spec: {
      host: 'ratings',
      trafficPolicy: {
        connectionPool: { tcp: { maxConnections: 50 } }
      }
    }
  }
];

// Mock Gateways
const mockGateways = [
  {
    apiVersion: 'networking.istio.io/v1',
    kind: 'Gateway',
    metadata: createIstioMetadata('bookinfo-gateway', 'bookinfo'),
    spec: {
      selector: { istio: 'ingressgateway' },
      servers: [
        {
          port: { number: 80, name: 'http', protocol: 'HTTP' },
          hosts: ['*']
        }
      ]
    }
  }
];

// Mock PeerAuthentications
const mockPeerAuthentications = [
  {
    apiVersion: 'security.istio.io/v1',
    kind: 'PeerAuthentication',
    metadata: createIstioMetadata('default', 'istio-system'),
    spec: {
      mtls: { mode: 'STRICT' }
    }
  }
];

// Mock AuthorizationPolicies
const mockAuthorizationPolicies = [
  {
    apiVersion: 'security.istio.io/v1',
    kind: 'AuthorizationPolicy',
    metadata: createIstioMetadata('allow-bookinfo', 'bookinfo'),
    spec: {
      action: 'ALLOW',
      rules: [
        {
          from: [{ source: { principals: ['cluster.local/ns/bookinfo/sa/bookinfo-productpage'] } }]
        }
      ]
    }
  }
];

// Helper to create validation for an object
const createValidation = (
  name: string,
  gvk: { Group: string; Kind: string; Version: string },
  valid = true,
  checks: Record<string, unknown>[] = []
): Record<string, unknown> => ({
  name,
  objectGVK: gvk,
  valid,
  checks,
  references: []
});

// GVK definitions
const virtualServiceGVK = { Group: 'networking.istio.io', Kind: 'VirtualService', Version: 'v1' };
const destinationRuleGVK = { Group: 'networking.istio.io', Kind: 'DestinationRule', Version: 'v1' };
const gatewayGVK = { Group: 'networking.istio.io', Kind: 'Gateway', Version: 'v1' };
const peerAuthGVK = { Group: 'security.istio.io', Kind: 'PeerAuthentication', Version: 'v1' };
const authPolicyGVK = { Group: 'security.istio.io', Kind: 'AuthorizationPolicy', Version: 'v1' };

// Validations map: { [gvkTypeString]: { [name.namespace]: ObjectValidation } }
// Key format is: name.namespace (e.g., "bookinfo-vs.bookinfo")
// Returns validations based on scenario with a mix of healthy and unhealthy configs
const generateMockValidations = (): Record<string, Record<string, Record<string, unknown>>> => {
  const scenarioConfig = getScenarioConfig();
  const hasIssues =
    scenarioConfig.unhealthyItems.length > 0 ||
    scenarioConfig.unhealthyNamespaces.length > 0 ||
    scenarioConfig.degradedItems.length > 0 ||
    scenarioConfig.degradedNamespaces.length > 0;

  // Different types of validation checks
  const errorChecks = [
    {
      code: 'KIA0101',
      message: 'DestinationRule not found for this host',
      path: 'spec/http[0]/route[0]/destination/host',
      severity: 'error'
    }
  ];

  const warningChecks = [
    {
      code: 'KIA0201',
      message: 'This subset is not referenced by any VirtualService',
      path: 'spec/subsets[1]',
      severity: 'warning'
    }
  ];

  const multipleErrorChecks = [
    {
      code: 'KIA0101',
      message: 'DestinationRule not found for this host',
      path: 'spec/http[0]/route[0]/destination/host',
      severity: 'error'
    },
    {
      code: 'KIA0102',
      message: 'VirtualService is pointing to a non-existent gateway',
      path: 'spec/gateways[0]',
      severity: 'error'
    }
  ];

  // In multicluster or scenarios with issues, create a realistic mix
  // Some configs healthy, some with warnings, some with errors
  if (hasIssues) {
    return {
      'networking.istio.io/v1, Kind=VirtualService': {
        // bookinfo-vs is healthy (valid)
        'bookinfo-vs.bookinfo': createValidation('bookinfo-vs', virtualServiceGVK, true, []),
        // reviews-vs has errors (invalid) - associated with degraded 'reviews' item
        'reviews-vs.bookinfo': createValidation('reviews-vs', virtualServiceGVK, false, errorChecks)
      },
      'networking.istio.io/v1, Kind=DestinationRule': {
        // productpage-dr is healthy (valid)
        'productpage-dr.bookinfo': createValidation('productpage-dr', destinationRuleGVK, true, []),
        // reviews-dr has warnings only (valid but with warnings)
        'reviews-dr.bookinfo': createValidation('reviews-dr', destinationRuleGVK, true, warningChecks),
        // ratings-dr has errors (invalid)
        'ratings-dr.bookinfo': createValidation('ratings-dr', destinationRuleGVK, false, multipleErrorChecks)
      },
      'networking.istio.io/v1, Kind=Gateway': {
        // bookinfo-gateway is healthy (valid)
        'bookinfo-gateway.bookinfo': createValidation('bookinfo-gateway', gatewayGVK, true, [])
      },
      'security.istio.io/v1, Kind=PeerAuthentication': {
        // PeerAuth in istio-system is healthy (valid)
        'default.istio-system': createValidation('default', peerAuthGVK, true, [])
      },
      'security.istio.io/v1, Kind=AuthorizationPolicy': {
        // AuthPolicy has warnings (valid but with warnings)
        'allow-bookinfo.bookinfo': createValidation('allow-bookinfo', authPolicyGVK, true, warningChecks)
      }
    };
  }

  // For healthy scenarios, all configs are valid with no issues
  return {
    'networking.istio.io/v1, Kind=VirtualService': {
      'bookinfo-vs.bookinfo': createValidation('bookinfo-vs', virtualServiceGVK, true, []),
      'reviews-vs.bookinfo': createValidation('reviews-vs', virtualServiceGVK, true, [])
    },
    'networking.istio.io/v1, Kind=DestinationRule': {
      'productpage-dr.bookinfo': createValidation('productpage-dr', destinationRuleGVK, true, []),
      'reviews-dr.bookinfo': createValidation('reviews-dr', destinationRuleGVK, true, []),
      'ratings-dr.bookinfo': createValidation('ratings-dr', destinationRuleGVK, true, [])
    },
    'networking.istio.io/v1, Kind=Gateway': {
      'bookinfo-gateway.bookinfo': createValidation('bookinfo-gateway', gatewayGVK, true, [])
    },
    'security.istio.io/v1, Kind=PeerAuthentication': {
      'default.istio-system': createValidation('default', peerAuthGVK, true, [])
    },
    'security.istio.io/v1, Kind=AuthorizationPolicy': {
      'allow-bookinfo.bookinfo': createValidation('allow-bookinfo', authPolicyGVK, true, [])
    }
  };
};

// IstioConfigList format expected by the frontend
// Returns config list dynamically based on scenario
const generateMockIstioConfigList = (): Record<string, unknown> => ({
  permissions: {
    'networking.istio.io/v1, Kind=VirtualService': { create: true, update: true, delete: true },
    'networking.istio.io/v1, Kind=DestinationRule': { create: true, update: true, delete: true },
    'networking.istio.io/v1, Kind=Gateway': { create: true, update: true, delete: true },
    'security.istio.io/v1, Kind=PeerAuthentication': { create: true, update: true, delete: true },
    'security.istio.io/v1, Kind=AuthorizationPolicy': { create: true, update: true, delete: true }
  },
  resources: {
    'networking.istio.io/v1, Kind=VirtualService': mockVirtualServices,
    'networking.istio.io/v1, Kind=DestinationRule': mockDestinationRules,
    'networking.istio.io/v1, Kind=Gateway': mockGateways,
    'security.istio.io/v1, Kind=PeerAuthentication': mockPeerAuthentications,
    'security.istio.io/v1, Kind=AuthorizationPolicy': mockAuthorizationPolicies
  },
  validations: generateMockValidations()
});

// Namespace-specific istio config in IstioConfigList format (used by workload details)
const mockNamespaceIstioConfig = {
  permissions: {
    'networking.istio.io/v1, Kind=VirtualService': { create: true, update: true, delete: true },
    'networking.istio.io/v1, Kind=DestinationRule': { create: true, update: true, delete: true },
    'networking.istio.io/v1, Kind=Gateway': { create: true, update: true, delete: true },
    'security.istio.io/v1, Kind=PeerAuthentication': { create: true, update: true, delete: true },
    'security.istio.io/v1, Kind=AuthorizationPolicy': { create: true, update: true, delete: true },
    'security.istio.io/v1, Kind=RequestAuthentication': { create: true, update: true, delete: true },
    'networking.istio.io/v1alpha3, Kind=EnvoyFilter': { create: true, update: true, delete: true },
    'networking.istio.io/v1, Kind=Sidecar': { create: true, update: true, delete: true },
    'networking.istio.io/v1, Kind=WorkloadGroup': { create: true, update: true, delete: true },
    'gateway.networking.k8s.io/v1, Kind=Gateway': { create: true, update: true, delete: true },
    'inference.networking.x-k8s.io/v1alpha2, Kind=InferencePool': { create: true, update: true, delete: true }
  },
  resources: {
    'networking.istio.io/v1, Kind=VirtualService': [],
    'networking.istio.io/v1, Kind=DestinationRule': [],
    'networking.istio.io/v1, Kind=Gateway': [],
    'security.istio.io/v1, Kind=PeerAuthentication': [],
    'security.istio.io/v1, Kind=AuthorizationPolicy': [],
    'security.istio.io/v1, Kind=RequestAuthentication': [],
    'networking.istio.io/v1alpha3, Kind=EnvoyFilter': [],
    'networking.istio.io/v1, Kind=Sidecar': [],
    'networking.istio.io/v1, Kind=WorkloadGroup': [],
    'gateway.networking.k8s.io/v1, Kind=Gateway': [],
    'inference.networking.x-k8s.io/v1alpha2, Kind=InferencePool': []
  },
  validations: {}
};

// IstioPermissions format: { [namespace]: { [type]: ResourcePermissions } }
const createPermissionsForNamespace = (): Record<string, { create: boolean; delete: boolean; update: boolean }> => ({
  'security.istio.io/v1, Kind=AuthorizationPolicy': { create: true, delete: true, update: true },
  'security.istio.io/v1, Kind=PeerAuthentication': { create: true, delete: true, update: true },
  'security.istio.io/v1, Kind=RequestAuthentication': { create: true, delete: true, update: true },
  'networking.istio.io/v1, Kind=DestinationRule': { create: true, delete: true, update: true },
  'networking.istio.io/v1, Kind=VirtualService': { create: true, delete: true, update: true },
  'networking.istio.io/v1, Kind=Gateway': { create: true, delete: true, update: true },
  'networking.istio.io/v1, Kind=ServiceEntry': { create: true, delete: true, update: true },
  'networking.istio.io/v1, Kind=Sidecar': { create: true, delete: true, update: true },
  'networking.istio.io/v1, Kind=WorkloadEntry': { create: true, delete: true, update: true },
  'networking.istio.io/v1, Kind=WorkloadGroup': { create: true, delete: true, update: true },
  'networking.istio.io/v1alpha3, Kind=EnvoyFilter': { create: true, delete: true, update: true },
  'telemetry.istio.io/v1, Kind=Telemetry': { create: true, delete: true, update: true },
  'extensions.istio.io/v1alpha1, Kind=WasmPlugin': { create: true, delete: true, update: true },
  'gateway.networking.k8s.io/v1, Kind=Gateway': { create: true, delete: true, update: true },
  'gateway.networking.k8s.io/v1, Kind=HTTPRoute': { create: true, delete: true, update: true },
  'gateway.networking.k8s.io/v1, Kind=GRPCRoute': { create: true, delete: true, update: true },
  'gateway.networking.k8s.io/v1alpha2, Kind=TCPRoute': { create: true, delete: true, update: true },
  'gateway.networking.k8s.io/v1alpha2, Kind=TLSRoute': { create: true, delete: true, update: true },
  'gateway.networking.k8s.io/v1beta1, Kind=ReferenceGrant': { create: true, delete: true, update: true }
});

const mockIstioPermissions: Record<string, Record<string, { create: boolean; delete: boolean; update: boolean }>> = {
  bookinfo: createPermissionsForNamespace(),
  'istio-system': createPermissionsForNamespace(),
  'travel-agency': createPermissionsForNamespace(),
  'travel-portal': createPermissionsForNamespace(),
  default: createPermissionsForNamespace()
};

const mockMeshTls = {
  status: 'ENABLED',
  autoMTLSEnabled: true,
  minTLS: 'TLSv1_2'
};

// Generate control planes dynamically from scenario
const generateControlPlanes = (): object[] => {
  const controlPlanes = getAllControlPlanes();

  return controlPlanes.map(cp => ({
    cluster: {
      accessible: cp.cluster.accessible,
      apiEndpoint: `https://${cp.cluster.name}.kubernetes.default.svc`,
      isKialiHome: cp.cluster.isHome,
      kialiInstances: cp.cluster.isHome
        ? [
            {
              namespace: 'istio-system',
              operatorResource: '',
              serviceName: 'kiali',
              url: 'http://localhost:20001/kiali',
              version: 'dev'
            }
          ]
        : [],
      name: cp.cluster.name,
      secretName: cp.cluster.isHome ? '' : `${cp.cluster.name}-secret`
    },
    config: cp.config,
    istiodName: cp.istiodName,
    istiodNamespace: cp.istiodNamespace,
    revision: cp.revision,
    status: cp.status,
    thresholds: cp.thresholds
  }));
};

const mockOutboundTrafficPolicy = {
  mode: 'ALLOW_ANY'
};

const mockIstiodThresholds = {
  cpu: 80,
  memory: 80
};

const mockCertsInfo = [
  {
    configMapName: 'istio-ca-root-cert',
    secretName: '',
    secretNamespace: 'istio-system',
    dnsNames: [],
    issuer: 'O=cluster.local',
    notAfter: '2036-01-18T07:43:00Z',
    notBefore: '2026-01-20T07:43:00Z',
    error: ''
  }
];

export const istioHandlers = [
  // Istio status
  http.get('*/api/istio/status', () => {
    return HttpResponse.json(generateIstioStatus());
  }),

  // Istio config for namespace
  http.get('*/api/namespaces/:namespace/istio', () => {
    return HttpResponse.json(mockNamespaceIstioConfig);
  }),

  // All istio configs - returns IstioConfigList format
  http.get('*/api/istio/config', () => {
    return HttpResponse.json(generateMockIstioConfigList());
  }),

  // Istio permissions
  http.get('*/api/istio/permissions', ({ request }) => {
    const url = new URL(request.url);
    const namespaces = url.searchParams.get('namespaces');

    if (namespaces) {
      const nsList = namespaces.split(',').map(ns => ns.trim());
      const result: Record<string, Record<string, { create: boolean; delete: boolean; update: boolean }>> = {};
      nsList.forEach(ns => {
        result[ns] = mockIstioPermissions[ns] || createPermissionsForNamespace();
      });
      return HttpResponse.json(result);
    }

    return HttpResponse.json(mockIstioPermissions);
  }),

  // Istio validations - returns ValidationStatus[] per namespace
  http.get('*/api/istio/validations', ({ request }) => {
    const url = new URL(request.url);
    const namespaces = url.searchParams.get('namespaces');

    // Object counts per namespace
    const objectCounts: Record<string, number> = {
      bookinfo: 6, // 2 VS + 3 DR + 1 Gateway
      'istio-system': 1, // 1 PeerAuthentication
      default: 0,
      'kube-system': 0,
      'travel-agency': 2,
      'travel-portal': 2,
      'travel-control': 1,
      alpha: 1,
      beta: 2,
      gamma: 3
    };

    const createValidationStatus = (namespace: string, clusterName: string): Record<string, unknown> => {
      // Use scenario config and per-cluster validation counts
      const scenarioConfig = getScenarioConfig();
      const clusterValidation = getClusterValidationCounts(clusterName);
      const isUnhealthy = scenarioConfig.unhealthyNamespaces.includes(namespace);
      const isDegraded = scenarioConfig.degradedNamespaces.includes(namespace);

      let errors = 0;
      let warnings = 0;

      if (isUnhealthy) {
        errors = Math.max(1, clusterValidation.errors);
        warnings = Math.max(1, Math.floor(clusterValidation.warnings / 2));
      } else if (isDegraded) {
        warnings = Math.max(1, clusterValidation.warnings);
      } else if (clusterValidation.errors > 0 || clusterValidation.warnings > 0) {
        // Apply cluster-level validation counts to some namespaces
        errors = Math.floor(clusterValidation.errors / 2);
        warnings = Math.floor(clusterValidation.warnings / 2);
      }

      return {
        cluster: clusterName,
        errors,
        namespace,
        objectCount: objectCounts[namespace] || 0,
        warnings
      };
    };

    // Get all namespaces from scenario with their clusters
    const scenarioConfig = getScenarioConfig();
    const allNamespaces: Array<{ cluster: string; namespace: string }> = [];
    scenarioConfig.clusters.forEach(cluster => {
      cluster.namespaces.forEach(ns => {
        allNamespaces.push({ cluster: cluster.name, namespace: ns });
      });
    });

    if (namespaces) {
      const nsList = namespaces.split(',').map(ns => ns.trim());
      const results = nsList.flatMap(ns => {
        // Find all clusters that have this namespace
        const clustersWithNs = allNamespaces.filter(item => item.namespace === ns);
        if (clustersWithNs.length === 0) {
          // Default to first cluster if namespace not found
          return [createValidationStatus(ns, scenarioConfig.clusters[0].name)];
        }
        return clustersWithNs.map(item => createValidationStatus(item.namespace, item.cluster));
      });
      return HttpResponse.json(results);
    }

    // Return validations for all namespaces across all clusters
    return HttpResponse.json(allNamespaces.map(item => createValidationStatus(item.namespace, item.cluster)));
  }),

  // Mesh TLS
  http.get('*/api/mesh/tls', () => {
    return HttpResponse.json(mockMeshTls);
  }),

  // Clusters TLS
  http.get('*/api/clusters/tls', () => {
    return HttpResponse.json([mockMeshTls]);
  }),

  // Control planes
  http.get('*/api/mesh/controlplanes', () => {
    return HttpResponse.json(generateControlPlanes());
  }),

  // Outbound traffic policy
  http.get('*/api/mesh/outbound_traffic_policy/mode', () => {
    return HttpResponse.json(mockOutboundTrafficPolicy);
  }),

  // Istiod resource thresholds
  http.get('*/api/mesh/resources/thresholds', () => {
    return HttpResponse.json(mockIstiodThresholds);
  }),

  // Certs info
  http.get('*/api/istio/certs', () => {
    return HttpResponse.json(mockCertsInfo);
  }),

  // Istio config detail
  http.get('*/api/namespaces/:namespace/istio/:group/:version/:kind/:name', ({ params }) => {
    const { namespace, group, version, kind, name } = params;
    const ns = namespace as string;
    const kindStr = kind as string;
    const nameStr = name as string;
    const groupStr = group as string;
    const versionStr = version as string;

    // Build the apiVersion from group and version
    const apiVersion = groupStr ? `${groupStr}/${versionStr}` : versionStr;

    // Only show validation issues in unhealthy scenario
    const scenarioConfig = getScenarioConfig();
    const isUnhealthyScenario =
      scenarioConfig.unhealthyItems.length > 0 || scenarioConfig.unhealthyNamespaces.length > 0;
    const hasValidationIssues = isUnhealthyScenario;

    // Create mock resource based on kind
    let spec: Record<string, unknown> = {};

    if (kindStr === 'VirtualService') {
      spec = {
        hosts: [`${nameStr.replace('-vs', '')}.${ns}.svc.cluster.local`],
        http: [
          {
            match: [{ uri: { prefix: '/' } }],
            route: [
              {
                destination: {
                  host: nameStr.replace('-vs', ''),
                  port: { number: 9080 },
                  subset: 'v1'
                },
                weight: 100
              }
            ]
          }
        ]
      };
    } else if (kindStr === 'DestinationRule') {
      spec = {
        host: nameStr.replace('-dr', ''),
        trafficPolicy: {
          connectionPool: {
            tcp: { maxConnections: 100 },
            http: { h2UpgradePolicy: 'UPGRADE' }
          }
        },
        subsets: [
          { name: 'v1', labels: { version: 'v1' } },
          { name: 'v2', labels: { version: 'v2' } },
          { name: 'v3', labels: { version: 'v3' } }
        ]
      };
    } else if (kindStr === 'Gateway') {
      spec = {
        selector: { istio: 'ingressgateway' },
        servers: [
          {
            port: { number: 80, name: 'http', protocol: 'HTTP' },
            hosts: ['*']
          }
        ]
      };
    } else if (kindStr === 'AuthorizationPolicy') {
      spec = {
        selector: { matchLabels: { app: nameStr.replace('-authz', '') } },
        action: 'ALLOW',
        rules: [
          {
            from: [{ source: { namespaces: ['istio-system'] } }],
            to: [{ operation: { methods: ['GET', 'POST'] } }]
          }
        ]
      };
    } else if (kindStr === 'PeerAuthentication') {
      spec = {
        mtls: { mode: 'STRICT' }
      };
    }

    // Build status with validationMessages for Istio's built-in analysis
    const status: Record<string, unknown> = {};
    if (hasValidationIssues) {
      status.validationMessages = [
        {
          documentationUrl: 'https://istio.io/latest/docs/reference/config/analysis/ist0101/',
          level: 'WARNING',
          type: { code: 'IST0101' },
          description: 'Referenced host not found: "reviews.bookinfo.svc.cluster.local"'
        },
        {
          documentationUrl: 'https://istio.io/latest/docs/reference/config/analysis/ist0106/',
          level: 'ERROR',
          type: { code: 'IST0106' },
          description: 'Schema validation error: gateway must have at least one server'
        }
      ];
    }

    const resource = {
      apiVersion,
      kind: kindStr,
      metadata: {
        name: nameStr,
        namespace: ns,
        creationTimestamp: new Date().toISOString(),
        resourceVersion: '12345',
        uid: `${nameStr}-${ns}-uid`,
        labels: {
          app: nameStr.replace(/-vs|-dr|-gateway|-authz/, '')
        },
        annotations: {}
      },
      spec,
      ...(Object.keys(status).length > 0 && { status })
    };

    // Build references based on the kind
    const references: {
      objectReferences: Array<{
        name: string;
        namespace: string;
        objectGVK: { Group: string; Kind: string; Version: string };
      }>;
      serviceReferences: Array<{ name: string; namespace: string }>;
      workloadReferences: Array<{ name: string; namespace: string }>;
    } = {
      objectReferences: [],
      serviceReferences: [],
      workloadReferences: []
    };

    if (kindStr === 'VirtualService') {
      // VirtualService references a DestinationRule and Gateway
      references.objectReferences = [
        {
          name: `${nameStr.replace('-vs', '')}-dr`,
          namespace: ns,
          objectGVK: { Group: 'networking.istio.io', Kind: 'DestinationRule', Version: 'v1' }
        },
        {
          name: 'bookinfo-gateway',
          namespace: ns,
          objectGVK: { Group: 'networking.istio.io', Kind: 'Gateway', Version: 'v1' }
        }
      ];
      references.serviceReferences = [{ name: nameStr.replace('-vs', ''), namespace: ns }];
      references.workloadReferences = [{ name: `${nameStr.replace('-vs', '')}-v1`, namespace: ns }];
    } else if (kindStr === 'DestinationRule') {
      // DestinationRule is referenced by VirtualService
      references.objectReferences = [
        {
          name: `${nameStr.replace('-dr', '')}-vs`,
          namespace: ns,
          objectGVK: { Group: 'networking.istio.io', Version: 'v1', Kind: 'VirtualService' }
        }
      ];
      references.serviceReferences = [{ name: nameStr.replace('-dr', ''), namespace: ns }];
      references.workloadReferences = [
        { name: `${nameStr.replace('-dr', '')}-v1`, namespace: ns },
        { name: `${nameStr.replace('-dr', '')}-v2`, namespace: ns },
        { name: `${nameStr.replace('-dr', '')}-v3`, namespace: ns }
      ];
    } else if (kindStr === 'Gateway') {
      // Gateway is referenced by VirtualServices
      references.objectReferences = [
        {
          name: 'bookinfo-vs',
          namespace: ns,
          objectGVK: { Group: 'networking.istio.io', Version: 'v1', Kind: 'VirtualService' }
        },
        {
          name: 'reviews-vs',
          namespace: ns,
          objectGVK: { Group: 'networking.istio.io', Version: 'v1', Kind: 'VirtualService' }
        }
      ];
      references.workloadReferences = [{ name: 'istio-ingressgateway', namespace: 'istio-system' }];
    } else if (kindStr === 'AuthorizationPolicy') {
      references.workloadReferences = [{ name: nameStr.replace('-authz', '-v1'), namespace: ns }];
    } else if (kindStr === 'PeerAuthentication') {
      // Mesh-wide PeerAuthentication affects all workloads
      references.workloadReferences = [
        { name: 'productpage-v1', namespace: 'bookinfo' },
        { name: 'details-v1', namespace: 'bookinfo' },
        { name: 'reviews-v1', namespace: 'bookinfo' },
        { name: 'ratings-v1', namespace: 'bookinfo' }
      ];
    }

    // Build Kiali validation checks
    const validationChecks: Array<{ code: string; message: string; path: string; severity: string }> = [];
    if (hasValidationIssues) {
      validationChecks.push(
        {
          code: 'KIA0505',
          message: 'Destination Rule enabling namespace-wide mTLS is missing',
          path: '',
          severity: 'warning'
        },
        {
          code: 'KIA1004',
          message: 'This host has no matching workloads',
          path: 'spec/hosts[0]',
          severity: 'error'
        },
        {
          code: 'KIA1107',
          message: 'Subset not found',
          path: 'spec/http[0]/route[0]/destination',
          severity: 'warning'
        }
      );
    }

    return HttpResponse.json({
      cluster: 'cluster-default',
      namespace: {
        name: ns,
        cluster: 'cluster-default'
      },
      permissions: {
        create: true,
        update: true,
        delete: true
      },
      references,
      resource,
      validation: {
        name: nameStr,
        objectGVK: { Group: groupStr, Version: versionStr, Kind: kindStr },
        valid: !hasValidationIssues,
        checks: validationChecks
      }
    });
  })
];
