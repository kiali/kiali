import { TracingUrlProvider } from 'types/Tracing';

export class GrafanaLegacyUrlProvider implements TracingUrlProvider {
  private readonly grafanaUrl: string | undefined;
  readonly valid: boolean = true;

  constructor(grafanaUrl: string) {
    this.grafanaUrl = grafanaUrl;
  }

  TraceUrl(traceID: string): string {
    return `${this.grafanaUrl}/explore?left={"queries":[{"datasource":{"type":"tempo"},"queryType":"traceql","query":"${traceID}"}]}`;
  }

  SpanUrl(traceID: string): string {
    return this.TraceUrl(traceID);
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
