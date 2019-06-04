import { ActionType, createStandardAction } from 'typesafe-actions';
import { TLSStatus } from '../types/TLSStatus';
import { ActionKeys } from './ActionKeys';

export const MeshTlsActions = {
  setinfo: createStandardAction(ActionKeys.MTLS_SET_INFO)<TLSStatus>()
};

export type MeshTlsAction = ActionType<typeof MeshTlsActions>;
