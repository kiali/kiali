import { ActionType, createStandardAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';
import { ClusterStatusMap } from '../components/IstioStatus/IstioStatus';

export const IstioStatusActions = {
  setinfo: createStandardAction(ActionKeys.ISTIO_STATUS_SET_INFO)<ClusterStatusMap>()
};

export type IstioStatusAction = ActionType<typeof IstioStatusActions>;
