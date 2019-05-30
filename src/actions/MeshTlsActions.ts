import { ActionType, createStandardAction } from 'typesafe-actions';
import { TLSStatus } from '../types/TLSStatus';

enum MeshTlsActionKeys {
  SET_INFO = 'SET_INFO'
}

export const MeshTlsActions = {
  setinfo: createStandardAction(MeshTlsActionKeys.SET_INFO)<TLSStatus>()
};

export type MeshTlsAction = ActionType<typeof MeshTlsActions>;
