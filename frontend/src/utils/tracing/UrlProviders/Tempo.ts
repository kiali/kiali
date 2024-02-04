import { ConcreteService, TracingUrlProvider } from 'types/Tracing';
import { ExternalServiceInfo } from 'types/StatusState';
import { BoundsInMilliseconds } from 'types/Common';
import { GrafanaLegacyUrlProvider } from './GrafanaLegacy';

interface TempoExternalService extends ConcreteService {
  name: 'tempo';
}

export function isTempoService(svc: ExternalServiceInfo): svc is TempoExternalService {
  return svc.name === 'tempo';
}

class nullProvider implements TracingUrlProvider {
  readonly valid: boolean = false;
  HomeUrl(): string {
    return '';
  }
  TraceUrl(): string {
    return '';
  }
  SpanUrl(): string {
    return '';
  }
  ComparisonUrl(): string {
    return '';
  }
  AppSearchUrl(): string {
    return '';
  }
}

export class TempoUrlProvider implements TracingUrlProvider {
  private readonly frontendProvider: TracingUrlProvider;
  readonly valid: boolean;

  constructor(externalServices: ExternalServiceInfo[]) {
    let frontendProvider: TracingUrlProvider | undefined = undefined;
    const svc = externalServices.find(s => ['grafana', 'jaeger'].includes(s.name.toLowerCase()));
    if (svc && svc.name.toLowerCase() === 'grafana' && svc.url !== undefined) {
      frontendProvider = new GrafanaLegacyUrlProvider(svc.url);
    }

    if (frontendProvider) {
      this.frontendProvider = frontendProvider;
    } else {
      this.frontendProvider = new nullProvider();
    }

    this.valid = this.frontendProvider.valid;
  }

  HomeUrl(): string {
    return this.frontendProvider.HomeUrl();
  }

  TraceUrl(traceID: string): string {
    return this.frontendProvider.TraceUrl(traceID);
  }

  SpanUrl(traceID: string, spanID: string): string {
    return this.frontendProvider.SpanUrl(traceID, spanID);
  }

  ComparisonUrl(traceId: string, ...traces: string[]): string | undefined {
    return this.frontendProvider.ComparisonUrl(traceId, ...traces);
  }

  AppSearchUrl(app: string, bounds: BoundsInMilliseconds, tags: Record<string, string>, limit: number): string {
    return this.frontendProvider.AppSearchUrl(app, bounds, tags, limit);
  }
}
