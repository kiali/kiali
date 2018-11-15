import { ActionType, createAction } from 'typesafe-actions';
import * as API from '../services/Api';
import { Component } from '../store/Store';
import { MessageType } from '../types/MessageCenter';
import { MessageCenterActions } from './MessageCenterActions';

enum HelpDropdownActionKeys {
  STATUS_REFRESH = 'STATUS_REFRESH'
}

export const HelpDropdownActions = {
  statusRefresh: createAction(
    HelpDropdownActionKeys.STATUS_REFRESH,
    resolve => (status: { [key: string]: string }, components: Component[], warningMessages: string[]) =>
      resolve({
        status: status,
        components: components,
        warningMessages: warningMessages
      })
  )
};

export const HelpDropdownThunkActions = {
  refresh: () => {
    return dispatch => {
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

export type HelpDropdownAction = ActionType<typeof HelpDropdownActions>;
