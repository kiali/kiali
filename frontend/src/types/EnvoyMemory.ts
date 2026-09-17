export type EnvoyMemoryCause = 'ok' | 'configuration' | 'traffic' | 'unknown';

export type EnvoyProxyType = 'sidecar' | 'waypoint' | 'gateway';

export type EnvoyMemorySummary = {
  activeClustersMax: number;
  activeConnections: number;
  cause: EnvoyMemoryCause;
  memoryLimitBytes: number;
  memoryMaxBytes: number;
  memoryThresholdBytes: number;
  memoryUsedPercent: number;
  proxyType: EnvoyProxyType;
  requestRate: number;
};
