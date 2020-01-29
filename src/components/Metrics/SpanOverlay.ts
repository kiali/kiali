import { PfColors, PFAlertColor } from 'components/Pf/PfColors';
import { toOverlay, OverlayInfo, Overlay } from '@kiali/k-charted-pf4';

import * as API from '../../services/Api';
import { DurationInSeconds } from '../../types/Common';
import * as AlertUtils from '../../utils/AlertUtils';
import { Span, TracingQuery } from 'types/Tracing';

export class SpanOverlay {
  spans: Span[] = [];
  lastFetchMicros: number | undefined;

  constructor(public onChange: (overlay?: Overlay) => void) {}

  fetch(namespace: string, service: string, duration: DurationInSeconds) {
    const doAppend = this.lastFetchMicros !== undefined;
    const nowMicros = new Date().getTime() * 1000;
    const frameStart = nowMicros - (duration + 60) * 1000000; // seconds to micros with 1min margin;
    const opts: TracingQuery = { startMicros: this.lastFetchMicros || frameStart };
    API.getServiceSpans(namespace, service, opts)
      .then(res => {
        this.spans = doAppend ? this.spans.filter(s => s.startTime >= frameStart).concat(res.data) : res.data;
        this.onChange(this.buildOverlay());
        // Update last fetch time only if we had some results
        // So that if Jaeger DB hadn't time to ingest data, it's still going to be fetched next time
        if (this.spans.length > 0) {
          this.lastFetchMicros = Math.max(...this.spans.map(s => s.startTime));
        }
      })
      .catch(err => {
        AlertUtils.addError('Could not fetch spans.', err);
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
          size: 4
        };
      });
      return toOverlay(info, dps);
    }
    return undefined;
  }
}
