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

export interface ClusterConfig {
  accessible: boolean;
  isHome: boolean;
  name: string;
  namespaces: string[];
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
        name: 'cluster-east',
        isHome: true,
        accessible: true,
        namespaces: ['bookinfo', 'istio-system', 'default']
      },
      {
        name: 'cluster-west',
        isHome: false,
        accessible: true,
        namespaces: ['bookinfo', 'istio-system', 'travel-agency']
      },
      {
        name: 'cluster-central',
        isHome: false,
        accessible: true,
        namespaces: ['istio-system', 'travel-portal', 'travel-control']
      }
    ],
    healthyNamespaces: ['bookinfo', 'istio-system', 'travel-agency', 'travel-portal', 'travel-control'],
    degradedNamespaces: [],
    degradedItems: [],
    unhealthyNamespaces: [],
    unhealthyItems: [],
    errorRate: 2,
    latencyMultiplier: 1,
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
export const getItemHealthStatus = (itemName: string, namespace?: string): 'healthy' | 'degraded' | 'unhealthy' => {
  const config = getScenarioConfig();

  // Extract base name (remove version suffix like -v1, -v2, etc.)
  const baseName = itemName.replace(/-v\d+$/, '');

  // Check if this specific item is unhealthy or degraded
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

// Helper to get all namespaces across all clusters
export const getAllNamespaces = (): Array<{ cluster: string; isAmbient: boolean; name: string }> => {
  const config = getScenarioConfig();
  const namespaces: Array<{ cluster: string; isAmbient: boolean; name: string }> = [];

  config.clusters.forEach(cluster => {
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
