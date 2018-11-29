import { ThunkDispatch } from 'redux-thunk';
import { KialiAppState } from '../store/Store';
import { MessageType } from '../types/MessageCenter';
import { HelpDropdownActions } from './HelpDropdownActions';
import { KialiAppAction } from './KialiAppAction';
import { MessageCenterActions } from './MessageCenterActions';
import * as API from '../services/Api';

const HelpDropdownThunkActions = {
  refresh: () => {
    return (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
      API.getStatus().then(
        status => {
          dispatch(
            HelpDropdownActions.statusRefresh(
              status['data']['status'],
              status['data']['externalServices'],
              status['data']['warningMessages']
            )
          );
          status['data']['warningMessages'].forEach(wMsg => {
            dispatch(MessageCenterActions.addMessage(wMsg, 'systemErrors', MessageType.WARNING));
          });
        },
        error => {
          dispatch(
            MessageCenterActions.addMessage(
              API.getErrorMsg('Error fetching status.', error),
              'default',
              MessageType.WARNING
            )
          );
        }
      );
    };
  }
};

export default HelpDropdownThunkActions;
