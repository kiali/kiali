import { ActionType, createStandardAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';

export const ServicesListActions = {
  setHiddenColumns: createStandardAction(ActionKeys.SERVICES_LIST_SET_HIDDEN_COLUMNS)<string[]>(),
  setColumnOrder: createStandardAction(ActionKeys.SERVICES_LIST_SET_COLUMN_ORDER)<string[]>()
};

export type ServicesListAction = ActionType<typeof ServicesListActions>;
