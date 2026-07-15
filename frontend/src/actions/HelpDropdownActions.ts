import type { ActionType } from 'types/typesafeActionsLegacy';
import { createAction } from 'types/typesafeActionsLegacy';
import type { StatusState } from '../types/StatusState';
import { ActionKeys } from './ActionKeys';

export const HelpDropdownActions = {
  statusRefresh: createAction(ActionKeys.HELP_STATUS_REFRESH, resolve => (status: StatusState) =>
    resolve({
      status: status.status,
      externalServices: status.externalServices,
      warningMessages: status.warningMessages,
      istioEnvironment: status.istioEnvironment
    })
  )
};

export type HelpDropdownAction = ActionType<typeof HelpDropdownActions>;
