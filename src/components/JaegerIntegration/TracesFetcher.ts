import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { JaegerTrace, JaegerError } from 'types/JaegerInfo';
import { transformTraceData } from './JaegerResults';
import { traceDurationUnits } from './ServiceTraces';
import { TracingQuery } from 'types/Tracing';
import { getTimeRangeMicros } from './JaegerHelper';

type FetchOptions = {
  namespace: string;
  service: string;
  intervalDuration: string;
  spanLimit: number;
  tags: string;
};

export class TracesFetcher {
  private traces: JaegerTrace[] = [];
  private lastFetchMicros: number | undefined = undefined;
  private lastFetchError = false;

  constructor(private onChange: (traces: JaegerTrace[]) => void, private onErrors: (err: JaegerError[]) => void) {}

  fetch = (opts: FetchOptions) => {
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
    API.getJaegerTraces(opts.namespace, opts.service, q)
      .then(response => {
        this.lastFetchError = false;
        const traces = response.data.data
          ? (response.data.data
              .map(trace => transformTraceData(trace))
              .filter(trace => trace !== null) as JaegerTrace[])
          : [];
        if (this.lastFetchMicros) {
          // Incremental refresh
          this.traces = this.traces.filter(s => s.startTime >= range.from).concat(traces);
        } else {
          this.traces = traces;
        }
        // Update last fetch time only if we had some results
        // So that if Jaeger DB hadn't time to ingest data, it's still going to be fetched next time
        if (traces.length > 0) {
          this.lastFetchMicros = Math.max(...traces.map(s => s.startTime));
        }
        this.onChange(this.filterTraces(opts.intervalDuration));
        if (response.data.errors && response.data.errors.length > 0) {
          this.onErrors(response.data.errors);
        }
      })
      .catch(error => {
        if (!this.lastFetchError) {
          AlertUtils.addError('Could not fetch traces.', error);
          this.lastFetchError = true;
        }
      });
  };

  filterTraces = (intervalDuration: string): JaegerTrace[] => {
    if (intervalDuration === 'none') {
      return this.traces;
    }
    const duration = intervalDuration.split('-');
    const index = Object.keys(traceDurationUnits).findIndex(el => el === duration[2]);
    const min = Number(duration[0]) * Math.pow(1000, index);
    const max = Number(duration[1]) * Math.pow(1000, index);
    return this.traces.filter(trace => trace.duration >= min && trace.duration <= max);
  };

  resetLastFetchTime() {
    this.lastFetchMicros = undefined;
  }
}
