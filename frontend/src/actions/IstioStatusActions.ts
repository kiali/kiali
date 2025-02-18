import { ActionType, createStandardAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';
import { ComponentStatus } from '../types/IstioStatus';

export const IstioStatusActions = {
  setinfo: createStandardAction(ActionKeys.ISTIO_STATUS_SET_INFO)<{
    cluster: string;
    istioStatus: ComponentStatus[];
  }>()
};

export type IstioStatusAction = ActionType<typeof IstioStatusActions>;
