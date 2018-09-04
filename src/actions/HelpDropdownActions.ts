import { createAction } from 'typesafe-actions';
import * as API from '../services/Api';
import { Component } from '../store/Store';
import { MessageType } from '../types/MessageCenter';
import { MessageCenterActions } from './MessageCenterActions';

export enum HelpDropdownActionKeys {
  STATUS_REFRESH = 'STATUS_REFRESH'
}

export const HelpDropdownActions = {
  statusRefresh: createAction(
    HelpDropdownActionKeys.STATUS_REFRESH,
    (status: { [key: string]: string }, components: Component[], warningMessages: string[]) => ({
      type: HelpDropdownActionKeys.STATUS_REFRESH,
      status: status,
      components: components,
      warningMessages: warningMessages
    })
  ),
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
