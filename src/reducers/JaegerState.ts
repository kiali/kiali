import { updateState } from '../utils/Reducer';
import { KialiAppAction } from '../actions/KialiAppAction';
import { getType } from 'typesafe-actions';
import { JaegerActions } from '../actions/JaegerActions';
import { JaegerInfo } from 'types/JaegerInfo';

export const INITIAL_JAEGER_STATE = null;

const JaegerStateGenerator = (
  state: JaegerInfo | null = INITIAL_JAEGER_STATE,
  action: KialiAppAction
): JaegerInfo | null => {
  switch (action.type) {
    case getType(JaegerActions.setInfo):
      if (!action.payload) {
        return null;
      }
      return updateState(state, {
        enabled: action.payload.enabled,
        integration: action.payload.integration,
        url: action.payload.url,
        namespaceSelector: action.payload.namespaceSelector
      });
    default:
      return state;
  }
};

export default JaegerStateGenerator;
