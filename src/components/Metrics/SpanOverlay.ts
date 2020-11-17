import { PfColors, PFAlertColor } from 'components/Pf/PfColors';

import * as API from 'services/Api';
import { TimeRange, durationToBounds, guardTimeRange } from 'types/Common';
import * as AlertUtils from 'utils/AlertUtils';
import { Span, TracingQuery } from 'types/Tracing';
import { MetricsObjectTypes } from 'types/Metrics';
import { LineInfo } from 'types/VictoryChartInfo';
import { Overlay, OverlayInfo } from 'types/Overlay';
import { toOverlay } from 'utils/VictoryChartsUtils';

export type JaegerLineInfo = LineInfo & { traceId?: string };

type FetchOptions = {
  namespace: string;
  target: string;
  targetKind: MetricsObjectTypes;
  range: TimeRange;
};

export class SpanOverlay {
  private spans: Span[] = [];
  private lastFetchError = false;

  constructor(public onChange: (overlay?: Overlay<JaegerLineInfo>) => void) {}

  reset() {
    this.spans = [];
  }

  fetch(opts: FetchOptions) {
    const boundsMillis = guardTimeRange(opts.range, durationToBounds, b => b);
    const q: TracingQuery = {
      startMicros: boundsMillis.from * 1000,
      endMicros: boundsMillis.to ? boundsMillis.to * 1000 : undefined
    };
    // Remove any out-of-bound spans
    this.spans = this.spans.filter(
      s => s.startTime >= q.startMicros && (q.endMicros === undefined || s.startTime <= q.endMicros)
    );
    // Start fetching from last fetched data when available
    if (this.spans.length > 0) {
      q.startMicros = 1 + Math.max(...this.spans.map(s => s.startTime));
    }
    const apiCall =
      opts.targetKind === MetricsObjectTypes.APP
        ? API.getAppSpans
        : opts.targetKind === MetricsObjectTypes.SERVICE
        ? API.getServiceSpans
        : API.getWorkloadSpans;
    apiCall(opts.namespace, opts.target, q)
      .then(res => {
        this.lastFetchError = false;
        // Incremental refresh: we keep existing spans
        this.spans = this.spans.concat(res.data);
        this.onChange(this.buildOverlay());
      })
      .catch(err => {
        if (!this.lastFetchError) {
          AlertUtils.addError('Could not fetch spans.', err);
          this.lastFetchError = true;
        }
      });
  }

  private buildOverlay(): Overlay<JaegerLineInfo> | undefined {
    if (this.spans.length > 0) {
      const info: OverlayInfo<JaegerLineInfo> = {
        lineInfo: {
          name: 'Span duration',
          unit: 'seconds',
          color: PfColors.Cyan300,
          symbol: 'circle',
          size: 10
        },
        dataStyle: { fill: ({ datum }) => (datum.error ? PFAlertColor.Danger : PfColors.Cyan300), fillOpacity: 0.6 },
        buckets: this.spans.length > 1000 ? 15 : 0
      };
      const dps = this.spans.map(span => {
        const hasError = span.tags.some(tag => tag.key === 'error' && tag.value);
        return {
          name: span.operationName,
          x: new Date(span.startTime / 1000),
          y: Number(span.duration / 1000000),
          error: hasError,
          color: hasError ? PFAlertColor.Danger : PfColors.Cyan300,
          size: 4,
          traceId: span.traceID
        };
      });
      return toOverlay(info, dps);
    }
    return undefined;
  }
}
