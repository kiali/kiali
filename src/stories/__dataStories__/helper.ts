import { Overlay, OverlayInfo } from '../../types/Overlay';
import { PFColors } from '../../components/Pf/PfColors';
import { toOverlay } from '../../utils/VictoryChartsUtils';
import { JaegerLineInfo } from '../../components/Metrics/SpanOverlay';
import { Span } from '../../types/Tracing';

export const buildOverlay = (spans: Span[]): Overlay<JaegerLineInfo> | undefined => {
  if (spans.length > 0) {
    const info: OverlayInfo<JaegerLineInfo> = {
      lineInfo: {
        name: 'Span duration',
        unit: 'seconds',
        color: '#009596',
        symbol: 'circle',
        size: 10
      },
      dataStyle: { fill: ({ datum }) => (datum.error ? PFColors.Danger : '#009596'), fillOpacity: 0.6 },
      buckets: spans.length > 1000 ? 15 : 0
    };
    const dps = spans.map(span => {
      const hasError = span.tags.some(tag => tag.key === 'error' && tag.value);
      const methodTags = span.tags.filter(tag => tag.key === 'http.method');
      const method = methodTags.length > 0 ? methodTags[0].value : undefined;
      return {
        name: `${method && `[${method}] `}${span.operationName}`,
        x: new Date(span.startTime / 1000),
        y: Number(span.duration / 1000000),
        error: hasError,
        color: hasError ? PFColors.Danger : PFColors.Cyan300,
        size: 4,
        traceId: span.traceID,
        spanId: span.spanID
      };
    });
    return toOverlay(info, dps);
  }
  return undefined;
};
