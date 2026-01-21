// Mock scenario configuration
// Usage: REACT_APP_MOCK_SCENARIO=unhealthy yarn start:mock

export type MockScenario =
  | 'healthy' // All services healthy (default)
  | 'unhealthy' // Some services with errors
  | 'multicluster' // Multiple clusters
  | 'ambient'; // Ambient mesh enabled

export interface ScenarioConfig {
  // Feature flags
  ambientEnabled: boolean;

  // Cluster configuration
  clusters: ClusterConfig[];

  // Health configuration
  degradedNamespaces: string[];

  // Traffic configuration
  errorRate: number; // 0-100 percentage

  healthyNamespaces: string[];
  latencyMultiplier: number; // 1 = normal, 2 = 2x slower

  // Istio config
  mtlsEnabled: boolean;
  tracingEnabled: boolean;
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
    unhealthyNamespaces: [],
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
    healthyNamespaces: ['istio-system'],
    degradedNamespaces: ['travel-agency'],
    unhealthyNamespaces: ['bookinfo', 'travel-portal'],
    errorRate: 25,
    latencyMultiplier: 1,
    ambientEnabled: false,
    tracingEnabled: true,
    mtlsEnabled: true,
    validationErrors: 5,
    validationWarnings: 3
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
    unhealthyNamespaces: [],
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
    unhealthyNamespaces: [],
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
    console.log(`[MSW] Using mock scenario: ${scenario}`);
    return scenario;
  }
  console.log('[MSW] Using default mock scenario: healthy');
  return 'healthy';
};

// Get scenario configuration
export const getScenarioConfig = (): ScenarioConfig => {
  return scenarios[getCurrentScenario()];
};

// Export for use in handlers
export const scenarioConfig = getScenarioConfig();

// Helper to check namespace health status
export const getNamespaceHealthStatus = (namespace: string): 'healthy' | 'degraded' | 'unhealthy' => {
  const config = scenarioConfig;
  if (config.unhealthyNamespaces.includes(namespace)) return 'unhealthy';
  if (config.degradedNamespaces.includes(namespace)) return 'degraded';
  return 'healthy';
};

// Helper to get all namespaces across all clusters
export const getAllNamespaces = (): Array<{ cluster: string; isAmbient: boolean; name: string }> => {
  const config = scenarioConfig;
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
  return scenarioConfig.clusters.length > 1;
};

// Helper to get home cluster
export const getHomeCluster = (): ClusterConfig => {
  return scenarioConfig.clusters.find(c => c.isHome) || scenarioConfig.clusters[0];
};
