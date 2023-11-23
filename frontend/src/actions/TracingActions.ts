import { ActionType, createAction, createStandardAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';
import { TracingInfo, JaegerTrace } from 'types/TracingInfo';

// synchronous action creators
export const TracingActions = {
  setInfo: createStandardAction(ActionKeys.TRACING_SET_INFO)<TracingInfo | null>(),
  setTrace: createAction(ActionKeys.TRACING_SET_TRACE, resolve => (trace?: JaegerTrace) =>
    resolve({ selectedTrace: trace })
  )
};

export type TracingAction = ActionType<typeof TracingActions>;
