import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { JaegerTrace, JaegerError } from 'types/JaegerInfo';
import { getQueryJaeger, changeParams } from './RouteHelper';
import { transformTraceData } from './JaegerResults';
import { URLParam } from 'app/History';
import { traceDurationUnits } from './ServiceTraces';

export class TracesFetcher {
  private traces: JaegerTrace[] = [];
  private params: any = {};
  private lastFetchMicros: number | undefined = undefined;
  private lastFetchError = false;

  constructor(private onChange: (traces: JaegerTrace[]) => void, private onErrors: (err: JaegerError[]) => void) {}

  fetch = (namespace: string, service: string, intervalDuration: string) => {
    // Refresh traces
    //   - params: Actual params that user selected in refresh moment like limit, tags, duration/frame
    //   - traceParams: Params stored in the object
    //   - lastFetchTraceMicros: In a interval from 't' to 't+1', we store in this value the last trace startTime,
    //       so this value will be <= 't+1'
    const params = getQueryJaeger();
    // changeParams return true if the specific params like limit or tag changed. In this case the refresh must be a new search.
    //     - we store the new params in traceParams
    //     - we set to undefined the frame that we use to search the new traces
    if (changeParams(this.params)) {
      // The user changed the params like tags or limit so we need to reset lastFetchTraceMicros
      this.params = params;
      this.lastFetchMicros = undefined;
    }
    const fetchParams = { ...params };
    // If we are adding new traces to the frame we set the startTime param in the search to the last startTime trace that we have.
    // Why?
    // Think in the case that we have a frame from 't-5' to 't'. And our last trace has the startTime in 't-2'.
    // If we fetch traces from t to t+duration we can miss a trace in the t-1 moment. So we are going to fetch traces from the last trace that we got.
    if (this.lastFetchMicros) {
      fetchParams[URLParam.JAEGER_START_TIME] = this.lastFetchMicros;
    }
    API.getJaegerTraces(namespace, service, fetchParams)
      .then((response) => {
        const traces = response.data.data
          ? (response.data.data
              .map((trace) => transformTraceData(trace))
              .filter((trace) => trace !== null) as JaegerTrace[])
          : [];
        // If lastFetchTraceMicros is defined that means that we are in a incremental refresh case.
        const appendTraces = this.lastFetchMicros !== undefined;
        this.lastFetchError = false;
        // Update last fetch time only if we had some results
        // So that if Jaeger DB hadn't time to ingest data, it's still going to be fetched next time
        if (traces.length > 0) {
          this.lastFetchMicros = Math.max(...traces.map((s) => s.startTime));
        }
        // In the case that we need to increment we are going to filter the traces in the frame and concatenate the results with the traces that we got
        this.traces = appendTraces
          ? this.traces.filter((t) => t.startTime >= params[URLParam.JAEGER_START_TIME]).concat(traces)
          : traces;
        this.onChange(this.filterTraces(intervalDuration));
        if (response.data.errors && response.data.errors.length > 0) {
          this.onErrors(response.data.errors);
        }
      })
      .catch((error) => {
        if (!this.lastFetchError) {
          AlertUtils.addError('Could not fetch traces.', error);
          this.lastFetchError = true;
          // throw error;
        }
      });
  };

  filterTraces = (intervalDuration: string): JaegerTrace[] => {
    if (intervalDuration === 'none') {
      return this.traces;
    }
    const duration = intervalDuration.split('-');
    const index = Object.keys(traceDurationUnits).findIndex((el) => el === duration[2]);
    const min = Number(duration[0]) * Math.pow(1000, index);
    const max = Number(duration[1]) * Math.pow(1000, index);
    return this.traces.filter((trace) => trace.duration >= min && trace.duration <= max);
  };

  resetLastFetchTime() {
    this.lastFetchMicros = undefined;
  }
}
