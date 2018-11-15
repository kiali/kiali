import { getType } from 'typesafe-actions';
import { GrafanaInfo } from '../store/Store';
import { GrafanaActions } from '../actions/GrafanaActions';
import { KialiAppAction } from '../actions/KialiAppAction';

export const INITIAL_GRAFANA_STATE: GrafanaInfo = {
  url: '',
  serviceDashboardPath: '',
  workloadDashboardPath: '',
  varNamespace: '',
  varService: '',
  varWorkload: ''
};

// This Reducer allows changes to the 'graphDataState' portion of Redux Store
const GrafanaState = (state: GrafanaInfo = INITIAL_GRAFANA_STATE, action: KialiAppAction): GrafanaInfo => {
  switch (action.type) {
    case getType(GrafanaActions.setinfo):
      return Object.assign({}, INITIAL_GRAFANA_STATE, {
        url: action.payload.url,
        serviceDashboardPath: action.payload.serviceDashboardPath,
        workloadDashboardPath: action.payload.workloadDashboardPath,
        varNamespace: action.payload.varNamespace,
        varService: action.payload.varService,
        varWorkload: action.payload.varWorkload
      });
    default:
      return state;
  }
};

export default GrafanaState;
