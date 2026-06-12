import { ActionType, createStandardAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';

export const AppsListActions = {
  setHiddenColumns: createStandardAction(ActionKeys.APPS_LIST_SET_HIDDEN_COLUMNS)<string[]>(),
  setColumnOrder: createStandardAction(ActionKeys.APPS_LIST_SET_COLUMN_ORDER)<string[]>()
};

export type AppsListAction = ActionType<typeof AppsListActions>;
