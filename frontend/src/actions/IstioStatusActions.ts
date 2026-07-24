import type { ActionType } from 'types/typesafeActionsLegacy';
import { createStandardAction } from 'types/typesafeActionsLegacy';
import { ActionKeys } from './ActionKeys';
import type { ClusterStatusMap } from '../components/IstioStatus/IstioStatus';

export const IstioStatusActions = {
  setinfo: createStandardAction(ActionKeys.ISTIO_STATUS_SET_INFO)<ClusterStatusMap>()
};

export type IstioStatusAction = ActionType<typeof IstioStatusActions>;
