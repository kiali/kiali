import { ConcreteService, TracingUrlProvider } from 'types/Tracing';
import { ExternalServiceInfo } from 'types/StatusState';
import { BoundsInMilliseconds } from 'types/Common';

interface JaegerExternalService extends ConcreteService {
  name: 'jaeger';
  url: string;
}

export function isJaegerService(svc: ExternalServiceInfo): svc is JaegerExternalService {
  return svc.name === 'jaeger';
}

export class JaegerUrlProvider implements TracingUrlProvider {
  private service: JaegerExternalService;
  readonly valid: boolean = true;

  constructor(service: JaegerExternalService) {
    this.service = service;
  }

  TraceUrl(traceID: string): string {
    return `${this.service.url}/trace/${traceID}`;
  }

  SpanUrl(traceID: string, spanID: string): string {
    return `${this.service.url}/trace/${traceID}?uiFind=${spanID}`;
  }

  ComparisonUrl(traceID: string, ...traces: string[]): string {
    return `${this.service.url}/trace/${traceID}...${traces[0]}?cohort=${traceID}${traces
      .slice(0, 10)
      .map(t => `&cohort=${t}`)
      .join('')}`;
  }

  AppSearchUrl(name: string, range: BoundsInMilliseconds, tags: Record<string, string>, limit: number): string {
    let url = `${this.service.url}/search?service=${name}&limit=${limit}`;
    if (range.from) {
      url += `&start=${range.from * 1000}`;
    }
    if (range.to) {
      url += `&end=${range.to * 1000}`;
    }

    if (tags) {
      url += `&tags=${encodeURIComponent(JSON.stringify(tags))}`;
    }
    return url;
  }

  HomeUrl(): string {
    return this.service.url;
  }
}
