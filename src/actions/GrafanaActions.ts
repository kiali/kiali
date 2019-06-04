import { ActionType, createStandardAction } from 'typesafe-actions';
import { GrafanaInfo } from '../store/Store';
import { ActionKeys } from './ActionKeys';

export const GrafanaActions = {
  setinfo: createStandardAction(ActionKeys.GRAFANA_SET_INFO)<GrafanaInfo | null>()
};

export type GrafanaAction = ActionType<typeof GrafanaActions>;
