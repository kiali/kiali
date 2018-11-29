import { ThunkDispatch } from 'redux-thunk';
import { KialiAppState } from '../store/Store';
import { GrafanaActions } from './GrafanaActions';
import { MessageType } from '../types/MessageCenter';
import { KialiAppAction } from './KialiAppAction';
import { MessageCenterActions } from './MessageCenterActions';
import * as API from '../services/Api';

const GrafanaThunkActions = {
  getInfo: (auth: string) => {
    return (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
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

export default GrafanaThunkActions;
