export interface Health {
  envoy: EnvoyHealth;
  deploymentStatuses: DeploymentStatus[];
  requests: RequestHealth;
}

export interface EnvoyHealth {
  inbound: EnvoyRatio;
  outbound: EnvoyRatio;
}

export interface EnvoyRatio {
  healthy: number;
  total: number;
}

export interface DeploymentStatus {
  name: string;
  replicas: number;
  available: number;
}

export interface RequestHealth {
  requestCount: number;
  requestErrorCount: number;
}
