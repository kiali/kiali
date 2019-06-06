import { JaegerState } from '../store/Store';
import { updateState } from '../utils/Reducer';
import { KialiAppAction } from '../actions/KialiAppAction';
import { getType } from 'typesafe-actions';
import { JaegerActions } from '../actions/JaegerActions';

export const INITIAL_JAEGER_STATE: JaegerState = {
  jaegerURL: '',
  enableIntegration: false
};

const JaegerStateGenerator = (state: JaegerState = INITIAL_JAEGER_STATE, action: KialiAppAction): JaegerState => {
  switch (action.type) {
    case getType(JaegerActions.setEnableIntegration):
      return updateState(state, {
        enableIntegration: action.payload
      });
    case getType(JaegerActions.setUrl):
      return updateState(state, {
        jaegerURL: action.payload.url
      });
    default:
      return state;
  }
};

export default JaegerStateGenerator;
