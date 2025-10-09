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

    // First, determine the URL based on configuration
    const targetUrl = this.getTargetUrl(service, externalServices);

    if (targetUrl) {
      // Then, instantiate the appropriate frontend provider based on URL format
      frontendProvider = this.createFrontendProvider(service, targetUrl);
    }

    if (frontendProvider) {
      this.frontendProvider = frontendProvider;
    } else {
      this.frontendProvider = new nullProvider();
    }

    this.valid = this.frontendProvider.valid;
  }

  private getTargetUrl(service: TempoExternalService, externalServices: ExternalServiceInfo[]): string | undefined {
    // Handle OpenShift URL format
    if (service.tempoConfig?.urlFormat === TempoUrlFormat.OPENSHIFT) {
      return service.url;
    }

    // Handle Grafana format
    if (service.tempoConfig?.urlFormat === TempoUrlFormat.GRAFANA) {
      // For Grafana format, prioritize Tempo service URL if available
      if (service.url) {
        return service.url;
      }
      // Fallback to Grafana service URL
      const grafanaSvc = externalServices.find(s => s.name.toLowerCase() === GRAFANA);
      return grafanaSvc?.url;
    }

    // Handle other formats (Jaeger, etc.) - use existing logic
    const svc = externalServices.find(s => [GRAFANA, JAEGER].includes(s.name.toLowerCase()));
    if (svc && svc.name.toLowerCase() === GRAFANA) {
      return svc.url;
    }

    return undefined;
  }

  private createFrontendProvider(service: TempoExternalService, targetUrl: string): TracingUrlProvider | undefined {
    // Handle OpenShift URL format
    if (service.tempoConfig?.urlFormat === TempoUrlFormat.OPENSHIFT) {
      return new OpenShiftUrlProvider(service);
    }

    // Handle Grafana formats (both GRAFANA and other formats that use Grafana)
    if (service.tempoConfig?.datasourceUID !== undefined) {
      // Grafana 10+
      return new GrafanaUrlProvider(targetUrl, {
        datasource_uid: service.tempoConfig.datasourceUID,
        orgID: service.tempoConfig.orgID
      });
    } else {
      // Fallback to older Grafana URL schema
      return new GrafanaLegacyUrlProvider(targetUrl);
    }
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
