import { ActionType, createStandardAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';
import { TimeInMilliseconds } from 'types/Common';
import { MeshDefinition, MeshTarget } from 'types/Mesh';
import { MeshLayout } from 'pages/Mesh/layouts/layoutFactory';

export const MeshActions = {
  setDefinition: createStandardAction(ActionKeys.MESH_SET_DEFINITION)<MeshDefinition>(),
  setLayout: createStandardAction(ActionKeys.MESH_SET_LAYOUT)<MeshLayout>(),
  setTarget: createStandardAction(ActionKeys.MESH_SET_TARGET)<MeshTarget>(),
  setUpdateTime: createStandardAction(ActionKeys.MESH_SET_UPDATE_TIME)<TimeInMilliseconds>()
};

export type MeshAction = ActionType<typeof MeshActions>;
