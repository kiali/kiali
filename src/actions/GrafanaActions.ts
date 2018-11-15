import { ActionType, createStandardAction } from 'typesafe-actions';
import { GrafanaInfo } from '../store/Store';
import * as API from '../services/Api';
import { MessageCenterActions } from './MessageCenterActions';
import { MessageType } from '../types/MessageCenter';

enum GrafanaActionKeys {
  SET_INFO = 'SET_INFO'
}

export const GrafanaActions = {
  setinfo: createStandardAction(GrafanaActionKeys.SET_INFO)<GrafanaInfo>()
};

export const GrafanaThunkActions = {
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

export type GrafanaAction = ActionType<typeof GrafanaActions>;
