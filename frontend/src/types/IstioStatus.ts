import { t } from 'utils/I18nUtils';

export enum Status {
  Healthy = 'Healthy',
  Unhealthy = 'Unhealthy',
  Unreachable = 'Unreachable',
  NotFound = 'NotFound',
  NotReady = 'NotReady'
}

export const statusMsg = {
  [Status.Healthy]: t('Healthy'),
  [Status.NotFound]: t('Not found'),
  [Status.NotReady]: t('Not ready'),
  [Status.Unhealthy]: t('Not healthy'),
  [Status.Unreachable]: t('Unreachable')
};

export const statusSeverity: Record<Status, number> = {
  [Status.Unhealthy]: 5,
  [Status.Unreachable]: 4,
  [Status.NotReady]: 3,
  [Status.NotFound]: 2,
  [Status.Healthy]: 1
};

export interface ComponentStatus {
  cluster: string;
  isCore: boolean;
  name: string;
  status: Status;
}

export interface IstiodResourceThresholds {
  cpu: number;
  memory: number;
}
