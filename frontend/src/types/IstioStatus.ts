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

export interface ComponentStatus {
  cluster: string;
  is_core: boolean;
  name: string;
  status: Status;
}

export interface IstiodResourceThresholds {
  cpu: number;
  memory: number;
}
