import { ConcreteService, TracingUrlProvider } from 'types/Tracing';
import { ExternalServiceInfo, TempoConfig } from 'types/StatusState';
import { BoundsInMilliseconds } from 'types/Common';
import { SpanData, TraceData } from '../../../types/TracingInfo';

interface OpenShiftExternalService extends ConcreteService {
  name: string;
  tempoConfig?: TempoConfig;
}

export function isOpenShiftService(svc: ExternalServiceInfo): svc is OpenShiftExternalService {
  return svc.name.toLowerCase().includes('openshift') || svc.name.toLowerCase().includes('console');
}

export class OpenShiftUrlProvider implements TracingUrlProvider {
  private service: OpenShiftExternalService;
  readonly valid: boolean = true;

  constructor(service: OpenShiftExternalService) {
    this.service = service;
  }

  private buildBaseUrl(): string {
    // Ensure the URL ends with a slash for proper path joining
    const baseUrl = this.service.url.endsWith('/') ? this.service.url : `${this.service.url}/`;
    return `${baseUrl}observe/traces`;
  }

  private buildQueryParams(bounds: BoundsInMilliseconds, tags: Record<string, string>, limit: number): string {
    const params = new URLSearchParams();

    // Add configurable parameters for OpenShift console
    const namespace = this.service.tempoConfig?.namespace || 'tempo';
    const name = this.service.tempoConfig?.name || 'sample';
    const tenant = this.service.tempoConfig?.tenant || 'default';

    params.append('namespace', namespace);
    params.append('name', name);
    params.append('tenant', tenant);

    // Map limit to one of the predefined values: 20, 50, 100, 500, 1000, 5000
    const limitRanges = [
      { max: 20, value: 20 },
      { max: 50, value: 50 },
      { max: 100, value: 100 },
      { max: 500, value: 500 },
      { max: 1000, value: 1000 }
    ];

    const limitValue = limitRanges.find(range => limit <= range.max)?.value || 5000;
    params.append('limit', limitValue.toString());

    // Add time range parameters
    if (bounds.from) {
      // If to is not provided, use current time (now)
      const to = bounds.to || Date.now();
      // Convert from milliseconds to seconds
      const durationSeconds = (to - bounds.from) / 1000;

      // Convert duration to one of the predefined values: 5m, 15m, 30m, 1h, 6h, 12h, 1d, 7d
      const durationRanges = [
        { max: 5 * 60, value: '5m' },
        { max: 15 * 60, value: '15m' },
        { max: 30 * 60, value: '30m' },
        { max: 60 * 60, value: '1h' },
        { max: 6 * 60 * 60, value: '6h' },
        { max: 12 * 60 * 60, value: '12h' },
        { max: 24 * 60 * 60, value: '1d' }
      ];

      const durationValue = durationRanges.find(range => durationSeconds <= range.max)?.value || '7d';
      params.append('duration', durationValue);
    }

    // Add tags as query parameter
    if (tags && Object.keys(tags).length > 0) {
      params.append('tags', encodeURIComponent(JSON.stringify(tags)));
    } else {
      params.append('tags', encodeURIComponent(JSON.stringify({})));
    }

    return params.toString();
  }

  private buildServiceQuery(serviceName: string): string {
    // Build the query parameter for service name
    const query = `{ resource.service.name = "${serviceName}" }`;
    return encodeURIComponent(query);
  }

  TraceUrl(trace: TraceData<any>): string {
    const baseUrl = this.buildBaseUrl();
    const traceId = trace.traceID;

    // For trace URLs, we need to include the trace ID in the path and add query parameters
    // Use current time as fallback since TraceData doesn't have startTime/duration
    const now = Date.now() / 1000;
    const queryParams = this.buildQueryParams(
      { from: now - 3600, to: now }, // Default to last hour
      {},
      100
    );
    return `${baseUrl}/${traceId}?${queryParams}`;
  }

  SpanUrl(span: SpanData): string {
    const baseUrl = this.buildBaseUrl();
    const traceId = span.traceID;

    // For span URLs, we include the trace ID in the path and add query parameters
    // OpenShift console will handle highlighting the specific span
    const queryParams = this.buildQueryParams({ from: span.startTime, to: span.startTime + span.duration }, {}, 100);
    return `${baseUrl}/${traceId}?${queryParams}`;
  }

  ComparisonUrl(traceID: string, ...traces: string[]): string | undefined {
    // OpenShift console doesn't seem to have a direct comparison feature
    // Return the first trace URL as a fallback with query parameters
    if (traces.length > 0) {
      return this.TraceUrl({
        traceID: traces[0],
        processes: {},
        spans: []
      } as TraceData<any>);
    }
    return this.TraceUrl({
      traceID,
      processes: {},
      spans: []
    } as TraceData<any>);
  }

  AppSearchUrl(serviceName: string, bounds: BoundsInMilliseconds, tags: Record<string, string>, limit: number): string {
    const baseUrl = this.buildBaseUrl();
    const queryParams = this.buildQueryParams(bounds, tags, limit);
    const serviceQuery = this.buildServiceQuery(serviceName);

    return `${baseUrl}?${queryParams}&q=${serviceQuery}`;
  }

  HomeUrl(): string {
    return this.buildBaseUrl();
  }
}
