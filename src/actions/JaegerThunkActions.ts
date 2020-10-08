import { ThunkDispatch } from 'redux-thunk';

import * as AlertUtils from '../utils/AlertUtils';
import { KialiAppState } from '../store/Store';
import * as API from '../services/Api';
import { KialiAppAction } from './KialiAppAction';
import { JaegerActions } from './JaegerActions';
import { setTraceId as setURLTraceId } from 'utils/SearchParamUtils';
import transformTraceData from 'components/JaegerIntegration/JaegerResults/transform';
import { AxiosError } from 'axios';

export const JaegerThunkActions = {
  setTraceId: (traceId?: string) => {
    setURLTraceId(traceId);
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
          .catch(error => {
            if ((error as AxiosError).response?.status === 404) {
              setURLTraceId(undefined);
            }
            dispatch(JaegerActions.setTrace(undefined));
            AlertUtils.addMessage({
              ...AlertUtils.extractAxiosError('Could not fetch trace', error),
              showNotification: false
            });
          });
      } else {
        dispatch(JaegerActions.setTrace(undefined));
      }
    };
  }
};
