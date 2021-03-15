export enum Status {
  Healthy = 'Healthy',
  Unhealthy = 'Unhealthy',
  Unreachable = 'Unreachable',
  NotFound = 'NotFound',
  NotReady = 'NotReady'
}

export interface ComponentStatus {
  name: string;
  status: Status;
  is_core: boolean;
}
