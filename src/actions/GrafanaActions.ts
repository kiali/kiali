import { ActionType, createStandardAction } from 'typesafe-actions';
import { GrafanaInfo } from '../store/Store';

enum GrafanaActionKeys {
  SET_INFO = 'SET_INFO'
}

export const GrafanaActions = {
  setinfo: createStandardAction(GrafanaActionKeys.SET_INFO)<GrafanaInfo>()
};

export type GrafanaAction = ActionType<typeof GrafanaActions>;
