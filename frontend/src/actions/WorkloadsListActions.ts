import type { ActionType } from 'types/typesafeActionsLegacy';
import { createStandardAction } from 'types/typesafeActionsLegacy';
import { ActionKeys } from './ActionKeys';

export const WorkloadsListActions = {
  setHiddenColumns: createStandardAction(ActionKeys.WORKLOADS_LIST_SET_HIDDEN_COLUMNS)<string[]>(),
  setColumnOrder: createStandardAction(ActionKeys.WORKLOADS_LIST_SET_COLUMN_ORDER)<string[]>()
};

export type WorkloadsListAction = ActionType<typeof WorkloadsListActions>;
