import * as _ from 'lodash';
import { TracingUrlProvider } from 'types/Tracing';
import { BoundsInMilliseconds } from 'types/Common';
import { SpanData, TraceData } from '../../../types/TracingInfo';

function dec2hex(dec: number): string {
  return dec.toString(16).padStart(2, '0');
}

function generateId(len: number): string {
  const arr = new Uint8Array((len || 40) / 2);
  window.crypto.getRandomValues(arr);
  return Array.from(arr, dec2hex).join('');
}

function base64ToHex(str: string): string {
  const raw = atob(str);
  let result = '';
  for (let i = 0; i < raw.length; i++) {
    const hex = raw.charCodeAt(i).toString(16);
    result += hex.length === 2 ? hex : `0${hex}`;
  }
  return result;
}

// In Grafana 10.1 (and probably 10.0, but the docs aren't clear) the URL schema has completely
// changed. Thankfully the new schema is documented, and should be stable. It also makes it
// possible to generate much more useful URLs. But does increase the complexity of generating
// those URLs.
//
// https://grafana.com/docs/grafana/v10.1/explore/#generating-explore-urls-from-external-tools
export class GrafanaUrlProvider implements TracingUrlProvider {
  private readonly datasourceUID: string;
  private readonly orgID: string;
  private readonly grafanaUrl: string | undefined;
  readonly valid: boolean = true;

  constructor(grafanaUrl: string, options: { datasource_uid: string; orgID?: string }) {
    this.datasourceUID = options.datasource_uid;
    this.orgID = options.orgID || '1';
    this.grafanaUrl = grafanaUrl;
  }

  HomeUrl(): string {
    const pane = {
      datasource: this.datasourceUID,
      queries: [
        {
          refId: 'A',
          datasource: {
            uid: this.datasourceUID,
            type: 'tempo'
          },
          queryType: 'traceqlSearch',
          limit: 20,
          tableType: 'traces',
          filters: [{ id: generateId(5), operator: '=', scope: 'span' }]
        }
      ]
    };
    return `${this.grafanaUrl}/explore?panes=${encodeURIComponent(JSON.stringify({ a: pane }))}&schemaVersion=1&orgId=${
      this.orgID
    }`;
  }

  TraceUrl(trace: TraceData<any>): string {
    const pane = {
      datasource: this.datasourceUID,
      queries: [
        {
          refId: 'A',
          datasource: {
            uid: this.datasourceUID,
            type: 'tempo'
          },
          queryType: 'traceql',
          query: trace.traceID
        }
      ]
    };

    return `${this.grafanaUrl}/explore?panes=${encodeURIComponent(JSON.stringify({ a: pane }))}&schemaVersion=1&orgId=${
      this.orgID
    }`;
  }

  SpanUrl(span: SpanData): string {
    const pane = {
      datasource: this.datasourceUID,
      // range: {from: span.},
      queries: [
        {
          query: span.traceID,
          queryType: 'traceql',
          refId: 'A',
          limit: 20,
          tableType: 'traces',
          datasource: { type: 'tempo', uid: this.datasourceUID }
        }
      ],
      panelsState: { trace: { spanId: base64ToHex(span.spanID) } }
    };

    return `${this.grafanaUrl}/explore?panes=${encodeURIComponent(JSON.stringify({ a: pane }))}&schemaVersion=1&orgId=${
      this.orgID
    }`;
  }

  ComparisonUrl(): undefined {
    return undefined;
  }

  AppSearchUrl(app: string, bounds: BoundsInMilliseconds, tags: Record<string, string>): string {
    const tagFilters = _.map(tags, (tag, value) => {
      return {
        id: generateId(5), // We need a random unique ID per filter
        tag: tag,
        operator: '=',
        scope: 'span',
        value: [value],
        valueType: 'string'
      };
    });

    const pane = {
      datasource: this.datasourceUID,
      range: { from: `${bounds.from ?? 'now-10m'}`, to: `${bounds.to ?? 'now'}` },
      queries: [
        {
          refId: 'A',
          datasource: {
            uid: this.datasourceUID,
            type: 'tempo'
          },
          queryType: 'traceqlSearch',
          // limit: limit,
          tableType: 'traces',
          filters: [
            {
              id: 'service-name',
              tag: 'service.name',
              operator: '=',
              scope: 'resource',
              value: [app],
              valueType: 'string'
            }
          ].concat(tagFilters)
        }
      ]
    };
    return `${this.grafanaUrl}/explore?panes=${encodeURIComponent(JSON.stringify({ a: pane }))}&schemaVersion=1&orgId=${
      this.orgID
    }`;
  }
}
