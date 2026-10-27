import type { ActionType } from 'types/typesafeActionsLegacy';
import { createStandardAction } from 'types/typesafeActionsLegacy';
import type { TLSStatus } from '../types/TLSStatus';
import { ActionKeys } from './ActionKeys';

export const MeshTlsActions = {
  setinfo: createStandardAction(ActionKeys.MTLS_SET_INFO)<TLSStatus>()
};

export type MeshTlsAction = ActionType<typeof MeshTlsActions>;
