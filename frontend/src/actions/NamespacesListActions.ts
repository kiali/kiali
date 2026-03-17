import { ActionType, createStandardAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';

export const NamespacesListActions = {
  setHiddenColumns: createStandardAction(ActionKeys.NAMESPACES_LIST_SET_HIDDEN_COLUMNS)<string[]>(),
  setColumnOrder: createStandardAction(ActionKeys.NAMESPACES_LIST_SET_COLUMN_ORDER)<string[]>()
};

export type NamespacesListAction = ActionType<typeof NamespacesListActions>;
