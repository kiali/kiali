import { updateState } from '../utils/Reducer';
import { KialiAppAction } from '../actions/KialiAppAction';
import { getType } from 'typesafe-actions';
import { TracingActions } from '../actions/TracingActions';
import { TracingInfo, JaegerTrace } from 'types/TracingInfo';

export const INITIAL_TRACING_STATE: TracingState = {};

export type TracingState = {
  info?: TracingInfo;
  selectedTrace?: JaegerTrace;
};

export const TracingStateReducer = (
  state: TracingState = INITIAL_TRACING_STATE,
  action: KialiAppAction
): TracingState => {
  switch (action.type) {
    case getType(TracingActions.setInfo):
      return updateState(state, { info: action.payload ? action.payload : undefined });
    case getType(TracingActions.setTrace):
      return updateState(state, { selectedTrace: action.payload.selectedTrace });
    default:
      return state;
  }
};
