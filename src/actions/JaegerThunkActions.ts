import { ThunkDispatch } from 'redux-thunk';

import * as AlertUtils from '../utils/AlertUtils';
import { KialiAppState } from '../store/Store';
import * as API from '../services/Api';
import { KialiAppAction } from './KialiAppAction';
import { transformTraceData } from 'components/JaegerIntegration/JaegerResults';
import { JaegerActions } from './JaegerActions';

export const JaegerThunkActions = {
  fetchTrace: (traceId?: string) => {
    return (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
      if (traceId) {
        API.getJaegerTrace(traceId)
          .then(response => {
            if (response.data.data) {
              const trace = transformTraceData(response.data.data);
              if (trace) {
                dispatch(JaegerActions.setTrace(trace));
              }
            }
          })
          .catch(error => AlertUtils.addError('Could not fetch trace.', error));
      } else {
        dispatch(JaegerActions.setTrace(undefined));
      }
    };
  }
};
