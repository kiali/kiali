import { ConcreteService, TracingUrlProvider, TEMPO, GRAFANA, JAEGER } from 'types/Tracing';
import { ExternalServiceInfo, TempoConfig, TempoUrlFormat } from 'types/StatusState';
import { BoundsInMilliseconds } from 'types/Common';
import { GrafanaLegacyUrlProvider } from './GrafanaLegacy';
import { GrafanaUrlProvider } from './Grafana';
import { OpenShiftUrlProvider } from './OpenShift';
import { SpanData, TraceData } from 'types/TracingInfo';

interface TempoExternalService extends ConcreteService {
  name: typeof TEMPO;
  tempoConfig?: TempoConfig;
}

export function isTempoService(svc: ExternalServiceInfo): svc is TempoExternalService {
  return svc.name === TEMPO;
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

  constructor(service: TempoExternalService, externalServices: ExternalServiceInfo[]) {
    let frontendProvider: TracingUrlProvider | undefined = undefined;

    // Handle OpenShift URL format
    if (service.tempoConfig?.urlFormat === TempoUrlFormat.OPENSHIFT) {
      // For OpenShift, we use the service's own URL
      if (service.url) {
        frontendProvider = new OpenShiftUrlProvider(service);
      }
    } else {
      // Handle Grafana and Jaeger formats
      const svc = externalServices.find(s => [GRAFANA, JAEGER].includes(s.name.toLowerCase()));
      if (svc && svc.name.toLowerCase() === GRAFANA && svc.url !== undefined) {
        if (service.tempoConfig?.datasourceUID !== undefined) {
          // Grafana 10+
          frontendProvider = new GrafanaUrlProvider(svc.url, {
            datasource_uid: service.tempoConfig.datasourceUID,
            orgID: service.tempoConfig.orgID
          });
        } else {
          // Fallback to older Grafana URL schema
          frontendProvider = new GrafanaLegacyUrlProvider(svc.url);
        }
      }
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

  TraceUrl(trace: TraceData<any>): string {
    return this.frontendProvider.TraceUrl(trace);
  }

  SpanUrl(span: SpanData): string {
    return this.frontendProvider.SpanUrl(span);
  }

  ComparisonUrl(traceId: string, ...traces: string[]): string | undefined {
    return this.frontendProvider.ComparisonUrl(traceId, ...traces);
  }

  AppSearchUrl(app: string, bounds: BoundsInMilliseconds, tags: Record<string, string>, limit: number): string {
    return this.frontendProvider.AppSearchUrl(app, bounds, tags, limit);
  }
}
