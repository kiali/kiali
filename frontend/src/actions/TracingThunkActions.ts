import { addError } from '../utils/AlertUtils';
import * as API from '../services/Api';
import { KialiDispatch } from '../types/Redux';
import { TracingActions } from './TracingActions';
import { setTraceId as setURLTraceId } from 'utils/SearchParamUtils';
import { transformTraceData } from 'utils/tracing/TraceTransform';
import { ApiError } from 'types/Api';

export const TracingThunkActions = {
  setTraceId: (cluster?: string, traceId?: string): ((dispatch: KialiDispatch) => void) => {
    setURLTraceId(traceId);

    return (dispatch: KialiDispatch) => {
      if (traceId) {
        API.getTrace(traceId)
          .then(response => {
            if (response.data.data) {
              const trace = transformTraceData(response.data.data, cluster);

              if (trace) {
                dispatch(TracingActions.setTrace(trace));
              }
            }
          })
          .catch((err: ApiError) => {
            if (err.response?.status === 404) {
              setURLTraceId(undefined);
            }

            dispatch(TracingActions.setTrace(undefined));

            addError('Could not fetch trace', err, false);
          });
      } else {
        dispatch(TracingActions.setTrace(undefined));
      }
    };
  }
};
