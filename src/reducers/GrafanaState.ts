import { GrafanaInfo } from '../store/Store';
import { GrafanaActionKeys } from '../actions/GrafanaActions';

export const INITIAL_GRAFANA_STATE: GrafanaInfo = {
  url: '',
  serviceDashboardPath: '',
  workloadDashboardPath: '',
  varNamespace: '',
  varService: '',
  varWorkload: ''
};

// This Reducer allows changes to the 'graphDataState' portion of Redux Store
const GrafanaState = (state: GrafanaInfo = INITIAL_GRAFANA_STATE, action) => {
  switch (action.type) {
    case GrafanaActionKeys.SET_INFO:
      return Object.assign({}, INITIAL_GRAFANA_STATE, {
        url: action.url,
        serviceDashboardPath: action.serviceDashboardPath,
        workloadDashboardPath: action.workloadDashboardPath,
        varNamespace: action.varNamespace,
        varService: action.varService,
        varWorkload: action.varWorkload
      });
    default:
      return state;
  }
};

export default GrafanaState;
