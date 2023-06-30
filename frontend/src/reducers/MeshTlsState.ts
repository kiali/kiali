import { getType } from 'typesafe-actions';
import { KialiAppAction } from '../actions/KialiAppAction';
import { TLSStatus } from '../types/TLSStatus';
import { MeshTlsActions } from '../actions/MeshTlsActions';

export const INITIAL_MESH_TLS_STATE: TLSStatus = {
  status: '',
  autoMTLSEnabled: false,
  minTLS: ''
};

// This Reducer allows changes to the 'graphDataState' portion of Redux Store
export const MeshTlsStateReducer = (state: TLSStatus = INITIAL_MESH_TLS_STATE, action: KialiAppAction): TLSStatus => {
  switch (action.type) {
    case getType(MeshTlsActions.setinfo):
      return {
        ...INITIAL_MESH_TLS_STATE,
        status: action.payload.status,
        autoMTLSEnabled: action.payload.autoMTLSEnabled,
        minTLS: action.payload.minTLS
      };
    default:
      return state;
  }
};
