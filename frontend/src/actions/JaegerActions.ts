import { ActionType, createAction, createStandardAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';
import { TracingInfo, JaegerTrace } from 'types/TracingInfo';

// synchronous action creators
export const JaegerActions = {
  setInfo: createStandardAction(ActionKeys.JAEGER_SET_INFO)<TracingInfo | null>(),
  setTrace: createAction(ActionKeys.JAEGER_SET_TRACE, resolve => (trace?: JaegerTrace) =>
    resolve({ selectedTrace: trace })
  )
};

export type JaegerAction = ActionType<typeof JaegerActions>;
