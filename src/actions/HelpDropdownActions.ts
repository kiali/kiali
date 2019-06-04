import { ActionType, createAction } from 'typesafe-actions';
import { Component } from '../store/Store';
import { ActionKeys } from './ActionKeys';

export const HelpDropdownActions = {
  statusRefresh: createAction(
    ActionKeys.HELP_STATUS_REFRESH,
    resolve => (status: { [key: string]: string }, components: Component[], warningMessages: string[]) =>
      resolve({
        status: status,
        components: components,
        warningMessages: warningMessages
      })
  )
};

export type HelpDropdownAction = ActionType<typeof HelpDropdownActions>;
