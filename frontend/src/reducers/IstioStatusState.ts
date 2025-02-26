import { KialiAppAction } from '../actions/KialiAppAction';
import { IstioStatusActions } from '../actions/IstioStatusActions';
import { getType } from 'typesafe-actions';
import { ClusterStatusMap } from '../components/IstioStatus/IstioStatus';

export const INITIAL_ISTIO_STATUS_STATE: ClusterStatusMap = {};

// This Reducer allows changes to the 'graphDataState' portion of Redux Store
export const IstioStatusStateReducer = (state: ClusterStatusMap = {}, action: KialiAppAction): ClusterStatusMap => {
  switch (action.type) {
    case getType(IstioStatusActions.setinfo):
      return {
        ...state,
        [action.payload.cluster]: action.payload.istioStatus
      };
    default:
      return state;
  }
};
