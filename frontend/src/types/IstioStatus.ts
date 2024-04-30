import { i18n } from 'i18n';

export enum Status {
  Healthy = 'Healthy',
  Unhealthy = 'Unhealthy',
  Unreachable = 'Unreachable',
  NotFound = 'NotFound',
  NotReady = 'NotReady'
}

export const statusMsg = {
  [Status.Healthy]: i18n.t('Healthy'),
  [Status.NotFound]: i18n.t('Not found'),
  [Status.NotReady]: i18n.t('Not ready'),
  [Status.Unhealthy]: i18n.t('Not healthy'),
  [Status.Unreachable]: i18n.t('Unreachable')
};

export interface ComponentStatus {
  is_core: boolean;
  name: string;
  status: Status;
}

export interface IstiodResourceThresholds {
  cpu: number;
  memory: number;
}
