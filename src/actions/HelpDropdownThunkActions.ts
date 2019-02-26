import { ThunkDispatch } from 'redux-thunk';
import { KialiAppState } from '../store/Store';
import { MessageType } from '../types/MessageCenter';
import { HelpDropdownActions } from './HelpDropdownActions';
import { JaegerActions } from './JaegerActions';
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

          // Get the jaeger URL
          const hasJaeger = status['data']['externalServices'].filter(item => item['name'] === 'Jaeger');
          if (hasJaeger.length === 1) {
            dispatch(JaegerActions.setUrl(hasJaeger[0]['url']));
            // If same protocol enable integration
            if (hasJaeger[0]['url'].startsWith(window.location.protocol)) {
              dispatch(JaegerActions.setEnableIntegration(true));
            }
          }

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
