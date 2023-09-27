import { updateState } from '../utils/Reducer';
import { KialiAppAction } from '../actions/KialiAppAction';
import { getType } from 'typesafe-actions';
import { JaegerActions } from '../actions/JaegerActions';
import { TracingInfo, JaegerTrace } from 'types/TracingInfo';

export const INITIAL_JAEGER_STATE: JaegerState = {};

export type JaegerState = {
  info?: TracingInfo;
  selectedTrace?: JaegerTrace;
};

export const JaegerStateReducer = (state: JaegerState = INITIAL_JAEGER_STATE, action: KialiAppAction): JaegerState => {
  switch (action.type) {
    case getType(JaegerActions.setInfo):
      return updateState(state, { info: action.payload ? action.payload : undefined });
    case getType(JaegerActions.setTrace):
      return updateState(state, { selectedTrace: action.payload.selectedTrace });
    default:
      return state;
  }
};
