import { getType } from 'typesafe-actions';
import { KialiAppAction } from '../actions/KialiAppAction';
import { TLSStatus } from '../types/TLSStatus';
import { MeshTlsActions } from '../actions/MeshTlsActions';

export const INITIAL_MESH_TLS_STATE: TLSStatus = {
  status: ''
};

// This Reducer allows changes to the 'graphDataState' portion of Redux Store
const MeshTlsState = (state: TLSStatus = INITIAL_MESH_TLS_STATE, action: KialiAppAction): TLSStatus => {
  switch (action.type) {
    case getType(MeshTlsActions.setinfo):
      return {
        ...INITIAL_MESH_TLS_STATE,
        status: action.payload.status
      };
    default:
      return state;
  }
};

export default MeshTlsState;
