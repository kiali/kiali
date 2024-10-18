import { ActionType, createStandardAction } from 'typesafe-actions';
import { Layout } from '../types/Graph';
import { ActionKeys } from './ActionKeys';
import { TimeInMilliseconds } from 'types/Common';
import { MeshDefinition, MeshTarget } from 'types/Mesh';

export const MeshActions = {
  setDefinition: createStandardAction(ActionKeys.MESH_SET_DEFINITION)<MeshDefinition>(),
  setLayout: createStandardAction(ActionKeys.MESH_SET_LAYOUT)<Layout>(),
  setTarget: createStandardAction(ActionKeys.MESH_SET_TARGET)<MeshTarget>(),
  setUpdateTime: createStandardAction(ActionKeys.MESH_SET_UPDATE_TIME)<TimeInMilliseconds>()
};

export type MeshAction = ActionType<typeof MeshActions>;
