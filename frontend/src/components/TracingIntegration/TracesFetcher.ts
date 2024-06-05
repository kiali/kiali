import * as API from 'services/Api';
import * as AlertUtils from 'utils/AlertUtils';
import { JaegerTrace, TracingError } from 'types/TracingInfo';
import { TracingQuery } from 'types/Tracing';
import { TargetKind } from 'types/Common';
import { getTimeRangeMicros } from 'utils/tracing/TracingHelper';
import { transformTraceData } from 'utils/tracing/TraceTransform';
import { isMultiCluster } from '../../config';

export type FetchOptions = {
  cluster?: string;
  minDuration?: number;
  namespace: string;
  spanLimit: number;
  tags: string;
  target: string;
  targetKind: TargetKind;
};

export class TracesFetcher {
  private lastFetchMicros: number | undefined = undefined;

  constructor(
    private onChange: (traces: JaegerTrace[], tracingServiceName: string) => void,
    private onErrors: (err: TracingError[]) => void
  ) {}

  fetch = (o: FetchOptions, oldTraces: JaegerTrace[]): void => {
    const range = getTimeRangeMicros();
    if (range.to) {
      // Closed time frame (looking in past)
      // Turning off incremental refresh as it doesn't make sense with bounded end time
      this.lastFetchMicros = undefined;
    }
    // Incremental refresh
    let traces = this.lastFetchMicros ? oldTraces.filter(t => t.startTime >= range.from) : [];
    const q: TracingQuery = {
      startMicros: this.lastFetchMicros || range.from,
      endMicros: range.to,
      tags: o.tags,
      limit: o.spanLimit,
      minDuration: o.minDuration ? Math.floor(1000 * o.minDuration) : undefined
    };
    const apiCall =
      o.targetKind === 'app'
        ? API.getAppTraces
        : o.targetKind === 'service'
        ? API.getServiceTraces
        : API.getWorkloadTraces;
    apiCall(o.namespace, o.target, q, o.cluster)
      .then(response => {
        const newTraces = response.data.data
          ? (response.data.data
              .map(trace => transformTraceData(trace, o.cluster ? o.cluster : ''))
              .filter(trace => trace !== null) as JaegerTrace[])
          : [];
        traces = traces
          // It may happen that a previous trace was updated. If so, replace it (remove from old).
          .filter(oldTrace => !newTraces.map(newTrace => newTrace.traceID).includes(oldTrace.traceID))
          .concat(newTraces);
        // Update last fetch time only if we had some results
        // So that if Jaeger DB hadn't time to ingest data, it's still going to be fetched next time
        if (traces.length > 0) {
          this.lastFetchMicros = Math.max(...traces.map(s => s.startTime));
        }
        this.onChange(traces, response.data.tracingServiceName);
        if (response.data.errors && response.data.errors.length > 0) {
          this.onErrors(response.data.errors);
        }
        if (response.data.fromAllClusters && isMultiCluster) {
          AlertUtils.addWarning(
            'Loading traces for all clusters. Tracing is not configured to store traces per cluster.'
          );
        }
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch traces.', error);
        this.onErrors([{ msg: String(error) }]);
      });
  };

  resetLastFetchTime(): void {
    this.lastFetchMicros = undefined;
  }
}
