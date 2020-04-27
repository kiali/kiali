export enum Status {
  Healthy = 'Healthy',
  Unhealthy = 'Unhealthy',
  NotFound = 'NotFound'
}

export interface ComponentStatus {
  name: string;
  status: Status;
  is_core: boolean;
}
