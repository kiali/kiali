// Action Creators allow us to create typesafe utilities for dispatching actions
import { ActionType, createAction, createStandardAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';

export const MeshToolbarActions = {
  resetSettings: createAction(ActionKeys.MESH_TOOLBAR_RESET_SETTINGS),
  setFindValue: createStandardAction(ActionKeys.MESH_TOOLBAR_SET_FIND_VALUE)<string>(),
  setHideValue: createStandardAction(ActionKeys.MESH_TOOLBAR_SET_HIDE_VALUE)<string>(),
  // Toggle actions
  toggleFindHelp: createAction(ActionKeys.MESH_TOOLBAR_TOGGLE_FIND_HELP),
  toggleLegend: createAction(ActionKeys.MESH_TOOLBAR_TOGGLE_LEGEND)
};

export type MeshToolbarAction = ActionType<typeof MeshToolbarActions>;
