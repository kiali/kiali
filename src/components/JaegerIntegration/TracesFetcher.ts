import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { JaegerTrace, JaegerError } from 'types/JaegerInfo';
import { TracingQuery } from 'types/Tracing';
import { getTimeRangeMicros } from './JaegerHelper';
import transformTraceData from './JaegerResults/transform';
import { TargetKind } from 'types/Common';

type FetchOptions = {
  namespace: string;
  target: string;
  targetKind: TargetKind;
  spanLimit: number;
  tags: string;
};

export class TracesFetcher {
  private lastFetchMicros: number | undefined = undefined;

  constructor(
    private onChange: (traces: JaegerTrace[], jaegerServiceName: string) => void,
    private onErrors: (err: JaegerError[]) => void
  ) {}

  fetch = (opts: FetchOptions, oldTraces: JaegerTrace[]) => {
    const range = getTimeRangeMicros();
    if (range.to) {
      // Closed time frame (looking in past)
      // Turning off incremental refresh as it doesn't make sense with bounded end time
      this.lastFetchMicros = undefined;
    }
    const q: TracingQuery = {
      startMicros: this.lastFetchMicros || range.from,
      endMicros: range.to,
      tags: opts.tags,
      limit: opts.spanLimit
    };
    const apiCall =
      opts.targetKind === 'app'
        ? API.getAppTraces
        : opts.targetKind === 'service'
        ? API.getServiceTraces
        : API.getWorkloadTraces;
    apiCall(opts.namespace, opts.target, q)
      .then(response => {
        const newTraces = response.data.data
          ? (response.data.data
              .map(trace => transformTraceData(trace))
              .filter(trace => trace !== null) as JaegerTrace[])
          : [];
        const traces = this.lastFetchMicros
          ? // Incremental refresh
            oldTraces
              .filter(t => t.startTime >= range.from)
              // It may happen that a previous trace was updated. If so, replace it (remove from old).
              .filter(oldTrace => !newTraces.map(newTrace => newTrace.traceID).includes(oldTrace.traceID))
              .concat(newTraces)
          : newTraces;
        // Update last fetch time only if we had some results
        // So that if Jaeger DB hadn't time to ingest data, it's still going to be fetched next time
        if (traces.length > 0) {
          this.lastFetchMicros = Math.max(...traces.map(s => s.startTime));
        }
        this.onChange(traces, response.data.jaegerServiceName);
        if (response.data.errors && response.data.errors.length > 0) {
          this.onErrors(response.data.errors);
        }
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch traces.', error);
      });
  };

  resetLastFetchTime() {
    this.lastFetchMicros = undefined;
  }
}
