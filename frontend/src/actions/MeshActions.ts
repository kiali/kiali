import { ActionType, createStandardAction } from 'typesafe-actions';
import { Layout } from '../types/Graph';
import { ActionKeys } from './ActionKeys';
import { TimeInMilliseconds } from 'types/Common';
import { MeshDefinition, MeshTarget } from 'types/Mesh';

export const MeshActions = {
  setMeshDefinition: createStandardAction(ActionKeys.MESH_SET_DEFINITION)<MeshDefinition>(),
  setMeshLayout: createStandardAction(ActionKeys.MESH_SET_LAYOUT)<Layout>(),
  setMeshTarget: createStandardAction(ActionKeys.MESH_SET_TARGET)<MeshTarget>(),
  setMeshUpdateTime: createStandardAction(ActionKeys.MESH_SET_UPDATE_TIME)<TimeInMilliseconds>()
};

export type MeshAction = ActionType<typeof MeshActions>;
