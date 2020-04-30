import { PfColors, PFAlertColor } from 'components/Pf/PfColors';
import { toOverlay, OverlayInfo, Overlay } from '@kiali/k-charted-pf4';

import * as API from '../../services/Api';
import { TimeRange, durationToBounds, guardTimeRange } from '../../types/Common';
import * as AlertUtils from '../../utils/AlertUtils';
import { Span, TracingQuery } from 'types/Tracing';

export class SpanOverlay {
  private spans: Span[] = [];
  private lastFetchMicros: number | undefined;
  private lastFetchError = false;

  constructor(public onChange: (overlay?: Overlay) => void) {}

  fetch(namespace: string, service: string, range: TimeRange) {
    const boundsMillis = guardTimeRange(range, durationToBounds, b => b);
    // Convert start time to microseconds with 1min margin
    const frameStart = (boundsMillis.from - 60000) * 1000;
    const frameEnd = boundsMillis.to ? boundsMillis.to * 1000 : undefined;
    if (frameEnd) {
      // Closed time frame (looking in past)
      // Turning off incremental refresh as it doesn't make sense with bounded end time
      this.lastFetchMicros = undefined;
    }
    const opts: TracingQuery = {
      startMicros: this.lastFetchMicros || frameStart,
      endMicros: frameEnd
    };
    API.getServiceSpans(namespace, service, opts)
      .then(res => {
        this.lastFetchError = false;
        if (this.lastFetchMicros) {
          // Incremental refresh
          this.spans = this.spans.filter(s => s.startTime >= frameStart).concat(res.data);
        } else {
          this.spans = res.data;
        }
        this.onChange(this.buildOverlay());
        // Update last fetch time only if we had some results
        // So that if Jaeger DB hadn't time to ingest data, it's still going to be fetched next time
        if (this.spans.length > 0) {
          this.lastFetchMicros = Math.max(...this.spans.map(s => s.startTime));
        }
      })
      .catch(err => {
        if (!this.lastFetchError) {
          AlertUtils.addError('Could not fetch spans.', err);
          this.lastFetchError = true;
        }
      });
  }

  resetLastFetchTime() {
    this.lastFetchMicros = undefined;
  }

  private buildOverlay(): Overlay | undefined {
    if (this.spans.length > 0) {
      const info: OverlayInfo = {
        title: 'Span duration',
        unit: 'seconds',
        dataStyle: { fill: ({ datum }) => (datum.error ? PFAlertColor.Danger : PfColors.Cyan300), fillOpacity: 0.6 },
        color: PfColors.Cyan300,
        symbol: 'circle',
        size: 10
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
