import { TracingUrlProvider } from 'types/Tracing';
import { SpanData, TraceData } from '../../../types/TracingInfo';

export class GrafanaLegacyUrlProvider implements TracingUrlProvider {
  private readonly grafanaUrl: string | undefined;
  readonly valid: boolean = true;

  constructor(grafanaUrl: string) {
    this.grafanaUrl = grafanaUrl;
  }

  TraceUrl(trace: TraceData<any> | SpanData): string {
    return `${this.grafanaUrl}/explore?left={"queries":[{"datasource":{"type":"tempo"},"queryType":"traceql","query":"${trace.traceID}"}]}`;
  }

  SpanUrl(span: SpanData): string {
    return this.TraceUrl(span);
  }

  ComparisonUrl(): undefined {
    return undefined;
  }

  AppSearchUrl(app: string): string {
    return `${this.grafanaUrl}/explore?left={"queries":[{"datasource":{"type":"tempo"},"queryType":"nativeSearch","serviceName":"${app}"}]}`;
  }

  HomeUrl(): string {
    return `${this.grafanaUrl}/explore?left={"queries":[{"datasource":{"type":"tempo"},"queryType":"nativeSearch"}]}`;
  }
}
