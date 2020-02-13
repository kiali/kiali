import { ActionType, createAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';

// synchronous action creators
export const GraphDataActions = {
  handleLegend: createAction(ActionKeys.HANDLE_LEGEND)
};

export type GraphDataAction = ActionType<typeof GraphDataActions>;
