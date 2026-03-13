import { ActionType, createStandardAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';

export const NamespacesListActions = {
  setHiddenColumns: createStandardAction(ActionKeys.NAMESPACES_LIST_SET_HIDDEN_COLUMNS)<string[]>()
};

export type NamespacesListAction = ActionType<typeof NamespacesListActions>;
