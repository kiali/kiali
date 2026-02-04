export enum HealthStatus {
  Healthy = 'healthy',
  Degraded = 'degraded',
  Unhealthy = 'unhealthy'
}

export const isDegraded = (entity: { healthStatus?: HealthStatus }): boolean =>
  entity.healthStatus === HealthStatus.Degraded;
export const isHealthy = (entity: { healthStatus?: HealthStatus | string }): boolean =>
  entity.healthStatus === HealthStatus.Healthy;
export const isUnhealthy = (entity: { healthStatus?: HealthStatus | string }): boolean =>
  entity.healthStatus === HealthStatus.Unhealthy;
