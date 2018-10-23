import { createAction } from 'typesafe-actions';
import { GrafanaInfo } from '../store/Store';
import * as API from '../services/Api';
import { MessageCenterActions } from './MessageCenterActions';
import { MessageType } from '../types/MessageCenter';

export enum GrafanaActionKeys {
  SET_INFO = 'SET_INFO'
}

export const GrafanaActions = {
  setinfo: createAction(GrafanaActionKeys.SET_INFO, (grafanaInfo: GrafanaInfo) => ({
    type: GrafanaActionKeys.SET_INFO,
    url: grafanaInfo.url,
    serviceDashboardPath: grafanaInfo.serviceDashboardPath,
    workloadDashboardPath: grafanaInfo.workloadDashboardPath,
    varNamespace: grafanaInfo.varNamespace,
    varService: grafanaInfo.varService,
    varWorkload: grafanaInfo.varWorkload
  })),
  getInfo: (auth: string) => {
    return dispatch => {
      API.getGrafanaInfo(auth)
        .then(response => {
          dispatch(GrafanaActions.setinfo(response.data));
        })
        .catch(error => {
          dispatch(
            MessageCenterActions.addMessage(
              API.getErrorMsg('Error fetching Grafana Info.', error),
              'default',
              MessageType.WARNING
            )
          );
        });
    };
  }
};
