import { JaegerState } from '../store/Store';
import { updateState } from '../utils/Reducer';
import { KialiAppAction } from '../actions/KialiAppAction';
import { getType } from 'typesafe-actions';
import { JaegerActions } from '../actions/JaegerActions';

export const INITIAL_JAEGER_STATE: JaegerState | null = {
  jaegerURL: '',
  integration: false,
  namespaceSelector: true,
  integrationMessage: ''
};

const JaegerStateGenerator = (
  state: JaegerState | null = INITIAL_JAEGER_STATE,
  action: KialiAppAction
): JaegerState | null => {
  switch (action.type) {
    case getType(JaegerActions.setEnableIntegration):
      return updateState(state, {
        integration: action.payload
      });
    case getType(JaegerActions.setUrl):
      return updateState(state, {
        jaegerURL: action.payload.url
      });
    case getType(JaegerActions.setinfo):
      if (!action.payload) {
        return null;
      }

      return updateState(state, {
        jaegerURL: action.payload.jaegerURL,
        integration: action.payload.integration,
        namespaceSelector: action.payload.namespaceSelector,
        integrationMessage: action.payload.integrationMessage
      });
    default:
      return state;
  }
};

export default JaegerStateGenerator;
