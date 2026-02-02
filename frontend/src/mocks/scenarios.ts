// Mock scenario configuration
// Usage: REACT_APP_MOCK_SCENARIO=unhealthy yarn start:mock

export type MockScenario =
  | 'healthy' // All services healthy (default)
  | 'ai' // Chat AI enabled
  | 'unhealthy' // Some services with errors
  | 'multicluster' // Multiple clusters
  | 'ambient'; // Ambient mesh enabled

export interface ScenarioConfig {
  // Feature flags
  ambientEnabled: boolean;

  // Chat AI configuration
  chatAI?: ChatbotAI;

  // Cluster configuration
  clusters: ClusterConfig[];

  // Health configuration - can be namespaces or specific items (app/workload names)
  degradedItems: string[]; // Items that are degraded (e.g., 'reviews', 'hotels')
  degradedNamespaces: string[];

  // Traffic configuration
  errorRate: number; // 0-100 percentage

  healthyNamespaces: string[];
  latencyMultiplier: number; // 1 = normal, 2 = 2x slower

  // Istio config
  mtlsEnabled: boolean;
  tracingEnabled: boolean;
  unhealthyItems: string[]; // Items that are unhealthy (e.g., 'ratings', 'flights')
  unhealthyNamespaces: string[];
  validationErrors: number;
  validationWarnings: number;
}

export interface ControlPlaneConfig {
  istiodName: string;
  istiodNamespace: string;
  revision: string;
  status: 'Healthy' | 'Degraded' | 'Unhealthy';
}

export interface ClusterConfig {
  accessible: boolean;
  // Control plane configuration (defaults to single healthy istiod if not specified)
  controlPlanes?: ControlPlaneConfig[];
  // Items that are degraded in this specific cluster
  degradedItems?: string[];
  // Health status for this cluster's control plane (deprecated, use controlPlanes)
  healthStatus?: 'Healthy' | 'Degraded' | 'Unhealthy';
  isHome: boolean;
  name: string;
  namespaces: string[];
  // Items that are unhealthy in this specific cluster
  unhealthyItems?: string[];
  // Validation errors/warnings for this cluster
  validationErrors?: number;
  validationWarnings?: number;
}

export interface ChatbotAI {
  defaultProvider?: string;
  enabled?: boolean;
  providers?: {
    defaultModel?: string;
    description?: string;
    models?: {
      description?: string;
      model?: string;
      name: string;
    }[];
    name: string;
  }[];
}
// Scenario definitions
const scenarios: Record<MockScenario, ScenarioConfig> = {
  healthy: {
    chatAI: {
      enabled: true,
      defaultProvider: 'openai',
      providers: [
        {
          name: 'openai',
          description: 'OpenAI API Provider',
          defaultModel: 'gemini',
          models: [
            {
              name: 'gemini',
              description: 'Model provided by Google with OpenAI API Support',
              model: 'gemini-2.5-pro'
            },
            {
              name: 'gpt-5-nano-2025-08-07',
              description: 'Model provided by OpenAI',
              model: 'gpt-5-nano-2025-08-07'
            },
            {
              name: 'gpt-failure-endpoint',
              description: 'GPT-4o',
              model: 'gpt-4o'
            }
          ]
        }
      ]
    },
    clusters: [
      {
        name: 'cluster-default',
        isHome: true,
        accessible: true,
        namespaces: ['bookinfo', 'istio-system', 'default', 'travel-agency', 'travel-portal', 'travel-control']
      }
    ],
    healthyNamespaces: ['bookinfo', 'istio-system', 'travel-agency', 'travel-portal', 'travel-control'],
    degradedNamespaces: [],
    degradedItems: [],
    unhealthyNamespaces: [],
    unhealthyItems: [],
    errorRate: 0,
    latencyMultiplier: 1,
    ambientEnabled: false,
    tracingEnabled: true,
    mtlsEnabled: true,
    validationErrors: 0,
    validationWarnings: 0
  },

  ai: {
    chatAI: {
      enabled: true,
      defaultProvider: 'openai',
      providers: [
        {
          name: 'openai',
          description: 'OpenAI API Provider',
          defaultModel: 'gemini',
          models: [
            {
              name: 'gemini',
              description: 'Model provided by Google with OpenAI API Support',
              model: 'gemini-2.5-pro'
            },
            {
              name: 'gpt-5-nano-2025-08-07',
              description: 'Model provided by OpenAI',
              model: 'gpt-5-nano-2025-08-07'
            },
            {
              name: 'gpt-failure-endpoint',
              description: 'GPT-4o',
              model: 'gpt-4o'
            }
          ]
        }
      ]
    },
    clusters: [
      {
        name: 'cluster-default',
        isHome: true,
        accessible: true,
        namespaces: ['bookinfo', 'istio-system', 'default', 'travel-agency', 'travel-portal', 'travel-control']
      }
    ],
    healthyNamespaces: ['bookinfo', 'istio-system', 'travel-agency', 'travel-portal', 'travel-control'],
    degradedNamespaces: [],
    degradedItems: [],
    unhealthyNamespaces: [],
    unhealthyItems: [],
    errorRate: 0,
    latencyMultiplier: 1,
    ambientEnabled: false,
    tracingEnabled: true,
    mtlsEnabled: true,
    validationErrors: 0,
    validationWarnings: 0
  },

  unhealthy: {
    clusters: [
      {
        name: 'cluster-default',
        isHome: true,
        accessible: true,
        namespaces: ['bookinfo', 'istio-system', 'default', 'travel-agency', 'travel-portal']
      }
    ],
    // Mix of healthy and unhealthy - all namespaces have healthy items
    healthyNamespaces: [],
    degradedNamespaces: [],
    unhealthyNamespaces: [],
    // Specific items that are unhealthy (red) - will have errors and 0 replicas
    unhealthyItems: ['reviews', 'ratings', 'flights', 'viaggi', 'grafana'],
    // Specific items that are degraded (yellow) - will have some errors but available
    degradedItems: ['hotels', 'voyages', 'prometheus'],
    errorRate: 30,
    latencyMultiplier: 2,
    ambientEnabled: false,
    tracingEnabled: true,
    mtlsEnabled: true,
    validationErrors: 3,
    validationWarnings: 5
  },

  multicluster: {
    clusters: [
      {
        // HEALTHY CLUSTER - Everything works well here
        name: 'cluster-east',
        isHome: true,
        accessible: true,
        namespaces: ['bookinfo', 'istio-system', 'default', 'alpha'],
        controlPlanes: [
          {
            istiodName: 'istiod',
            istiodNamespace: 'istio-system',
            revision: 'default',
            status: 'Healthy'
          }
        ],
        healthStatus: 'Healthy',
        // No unhealthy/degraded items - all apps healthy
        validationErrors: 0,
        validationWarnings: 0
      },
      {
        // MIXED CLUSTER - Some issues but mostly working
        name: 'cluster-west',
        isHome: false,
        accessible: true,
        namespaces: ['bookinfo', 'istio-system', 'travel-agency', 'travel-portal'],
        controlPlanes: [
          {
            istiodName: 'istiod',
            istiodNamespace: 'istio-system',
            revision: 'stable',
            status: 'Healthy'
          },
          {
            istiodName: 'istiod-canary',
            istiodNamespace: 'istio-system',
            revision: 'canary',
            status: 'Degraded'
          }
        ],
        healthStatus: 'Degraded',
        // Only reviews is degraded, everything else healthy
        degradedItems: ['reviews'],
        validationErrors: 1,
        validationWarnings: 2
      },
      {
        // PROBLEMATIC CLUSTER - Multiple issues
        name: 'cluster-central',
        isHome: false,
        accessible: true,
        namespaces: ['istio-system', 'travel-control', 'beta', 'gamma'],
        controlPlanes: [
          {
            istiodName: 'istiod',
            istiodNamespace: 'istio-system',
            revision: 'default',
            status: 'Unhealthy'
          }
        ],
        healthStatus: 'Unhealthy',
        // flights unhealthy, cars degraded - other apps healthy
        unhealthyItems: ['flights'],
        degradedItems: ['cars'],
        validationErrors: 4,
        validationWarnings: 3
      },
      {
        // INACCESSIBLE CLUSTER - Network issues
        name: 'cluster-south',
        isHome: false,
        accessible: false,
        namespaces: ['bookinfo', 'istio-system'],
        controlPlanes: [
          {
            istiodName: 'istiod',
            istiodNamespace: 'istio-system',
            revision: 'default',
            status: 'Healthy'
          }
        ],
        healthStatus: 'Healthy'
      }
    ],
    // Global namespace health (applied across all clusters unless overridden)
    healthyNamespaces: ['bookinfo', 'istio-system', 'default', 'alpha', 'travel-agency', 'beta'],
    degradedNamespaces: ['travel-portal'],
    degradedItems: [],
    unhealthyNamespaces: ['gamma'],
    unhealthyItems: [],
    errorRate: 10,
    latencyMultiplier: 1.2,
    ambientEnabled: false,
    tracingEnabled: true,
    mtlsEnabled: true,
    validationErrors: 0,
    validationWarnings: 0
  },

  ambient: {
    clusters: [
      {
        name: 'cluster-default',
        isHome: true,
        accessible: true,
        namespaces: ['bookinfo', 'istio-system', 'default', 'travel-agency', 'travel-portal', 'alpha', 'beta']
      }
    ],
    healthyNamespaces: ['bookinfo', 'istio-system', 'travel-agency', 'travel-portal', 'alpha', 'beta'],
    degradedNamespaces: [],
    degradedItems: [],
    unhealthyNamespaces: [],
    unhealthyItems: [],
    errorRate: 0,
    latencyMultiplier: 1,
    ambientEnabled: true,
    tracingEnabled: true,
    mtlsEnabled: true,
    validationErrors: 0,
    validationWarnings: 0
  }
};

// Get current scenario from environment
export const getCurrentScenario = (): MockScenario => {
  const scenario = process.env.REACT_APP_MOCK_SCENARIO as MockScenario;

  if (scenario && scenarios[scenario]) {
    return scenario;
  }

  // Default to healthy scenario if no scenario is specified
  return 'healthy';
};

// Get scenario configuration
export const getScenarioConfig = (): ScenarioConfig => {
  return scenarios[getCurrentScenario()];
};

// Helper to check namespace health status
export const getNamespaceHealthStatus = (namespace: string): 'healthy' | 'degraded' | 'unhealthy' => {
  const config = getScenarioConfig();
  if (config.unhealthyNamespaces.includes(namespace)) return 'unhealthy';
  if (config.degradedNamespaces.includes(namespace)) return 'degraded';
  return 'healthy';
};

// Helper to check individual item (app/workload/service) health status
// itemName can be workload name (e.g., 'reviews-v1') or app/service name (e.g., 'reviews')
// clusterName is optional to check cluster-specific health configuration
export const getItemHealthStatus = (
  itemName: string,
  namespace?: string,
  clusterName?: string
): 'healthy' | 'degraded' | 'unhealthy' => {
  const config = getScenarioConfig();

  // Extract base name (remove version suffix like -v1, -v2, etc.)
  const baseName = itemName.replace(/-v\d+$/, '');

  // Check cluster-specific health first if cluster is provided
  if (clusterName) {
    const cluster = config.clusters.find(c => c.name === clusterName);
    if (cluster) {
      if (cluster.unhealthyItems?.includes(baseName) || cluster.unhealthyItems?.includes(itemName)) {
        return 'unhealthy';
      }
      if (cluster.degradedItems?.includes(baseName) || cluster.degradedItems?.includes(itemName)) {
        return 'degraded';
      }
    }
  }

  // Check global item health
  if (config.unhealthyItems.includes(baseName) || config.unhealthyItems.includes(itemName)) {
    return 'unhealthy';
  }
  if (config.degradedItems.includes(baseName) || config.degradedItems.includes(itemName)) {
    return 'degraded';
  }

  // Fall back to namespace-level health if no item-level config
  if (namespace) {
    return getNamespaceHealthStatus(namespace);
  }

  return 'healthy';
};

// Helper to get all namespaces across all accessible clusters
export const getAllNamespaces = (): Array<{ cluster: string; isAmbient: boolean; name: string }> => {
  const config = getScenarioConfig();
  const namespaces: Array<{ cluster: string; isAmbient: boolean; name: string }> = [];

  config.clusters.forEach(cluster => {
    // Skip inaccessible clusters - their namespaces shouldn't appear in the UI
    if (!cluster.accessible) return;

    cluster.namespaces.forEach(ns => {
      namespaces.push({
        cluster: cluster.name,
        isAmbient: config.ambientEnabled && !ns.includes('istio-system'),
        name: ns
      });
    });
  });

  return namespaces;
};

// Helper to check if running in multicluster mode
export const isMultiCluster = (): boolean => {
  return getScenarioConfig().clusters.length > 1;
};

// Helper to get home cluster
export const getHomeCluster = (): ClusterConfig => {
  const config = getScenarioConfig();
  return config.clusters.find(c => c.isHome) || config.clusters[0];
};

// Helper to get cluster by name
export const getCluster = (clusterName: string): ClusterConfig | undefined => {
  const config = getScenarioConfig();
  return config.clusters.find(c => c.name === clusterName);
};

// Helper to get cluster health status
export const getClusterHealthStatus = (clusterName: string): 'Healthy' | 'Degraded' | 'Unhealthy' => {
  const cluster = getCluster(clusterName);
  return cluster?.healthStatus || 'Healthy';
};

// Helper to get validation counts for a cluster
export const getClusterValidationCounts = (clusterName: string): { errors: number; warnings: number } => {
  const config = getScenarioConfig();
  const cluster = config.clusters.find(c => c.name === clusterName);

  return {
    errors: cluster?.validationErrors ?? config.validationErrors,
    warnings: cluster?.validationWarnings ?? config.validationWarnings
  };
};

// Helper to get all control planes across all clusters
export const getAllControlPlanes = (): Array<{
  cluster: ClusterConfig;
  config: { ambientEnabled: boolean };
  istiodName: string;
  istiodNamespace: string;
  revision: string;
  status: string;
  thresholds: { cpu: number; memory: number };
}> => {
  const config = getScenarioConfig();
  const controlPlanes: Array<{
    cluster: ClusterConfig;
    config: { ambientEnabled: boolean };
    istiodName: string;
    istiodNamespace: string;
    revision: string;
    status: string;
    thresholds: { cpu: number; memory: number };
  }> = [];

  config.clusters.forEach(cluster => {
    const clusterControlPlanes = cluster.controlPlanes || [
      {
        istiodName: 'istiod',
        istiodNamespace: 'istio-system',
        revision: 'default',
        status: cluster.healthStatus || 'Healthy'
      }
    ];

    clusterControlPlanes.forEach(cp => {
      controlPlanes.push({
        cluster: cluster,
        config: { ambientEnabled: config.ambientEnabled },
        istiodName: cp.istiodName,
        istiodNamespace: cp.istiodNamespace,
        revision: cp.revision,
        status: cp.status,
        thresholds: { cpu: 80, memory: 80 }
      });
    });
  });

  return controlPlanes;
};
