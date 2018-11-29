import { ActionType, createAction } from 'typesafe-actions';
import { Component } from '../store/Store';

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

export type HelpDropdownAction = ActionType<typeof HelpDropdownActions>;
