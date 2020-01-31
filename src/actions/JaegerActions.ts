import { ActionType, createStandardAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';
import { JaegerInfo } from 'types/JaegerInfo';

// synchronous action creators
export const JaegerActions = {
  setInfo: createStandardAction(ActionKeys.JAEGER_SET_INFO)<JaegerInfo | null>()
};

export type JaegerAction = ActionType<typeof JaegerActions>;
