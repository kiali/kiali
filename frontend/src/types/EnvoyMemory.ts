export type EnvoyMemoryCause = 'ok' | 'configuration' | 'traffic' | 'unknown';

export type EnvoyMemoryMetric = 'allocated' | 'working_set';

export type EnvoyProxyType = 'sidecar' | 'waypoint' | 'gateway';

export type EnvoyMemorySummary = {
  activeClustersMax: number;
  activeConnections: number;
  cause: EnvoyMemoryCause;
  configCountsPod?: string;
  largeConfigClustersThreshold: number;
  memoryLimitBytes: number;
  memoryMaxBytes: number;
  memoryMetric: EnvoyMemoryMetric;
  memoryThresholdBytes: number;
  memoryUsedPercent: number;
  proxyType: EnvoyProxyType;
  requestRate: number;
  roughConfigMemoryBytes: number;
  trafficIsByteRate?: boolean;
};

export type EnvoyConfigCounts = {
  clusters: number;
  listeners: number;
  routes: number;
};
