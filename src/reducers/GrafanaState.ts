import { getType } from 'typesafe-actions';
import { GrafanaInfo } from '../store/Store';
import { GrafanaActions } from '../actions/GrafanaActions';
import { KialiAppAction } from '../actions/KialiAppAction';

export const INITIAL_GRAFANA_STATE: GrafanaInfo | null = null;

// This Reducer allows changes to the 'graphDataState' portion of Redux Store
const GrafanaState = (
  state: GrafanaInfo | null = INITIAL_GRAFANA_STATE,
  action: KialiAppAction
): GrafanaInfo | null => {
  switch (action.type) {
    case getType(GrafanaActions.setinfo):
      if (!action.payload) {
        // Ex: in case of response 204
        return null;
      }
      // Spread types can only be created from object types so need to use Object.assign here
      // tslint:disable-next-line
      return Object.assign({}, INITIAL_GRAFANA_STATE, {
        url: action.payload.url,
        serviceDashboardPath: action.payload.serviceDashboardPath,
        workloadDashboardPath: action.payload.workloadDashboardPath
      });
    default:
      return state;
  }
};

export default GrafanaState;
