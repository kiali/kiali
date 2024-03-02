import { BoundsInMilliseconds } from 'types/Common';
import { SpanData, TraceData } from './TracingInfo';

export type TracingQuery = {
  endMicros?: number;
  limit?: number;
  minDuration?: number;
  startMicros: number;
  tags?: string;
};

export type Span = {
  duration: number;
  operationName: string;
  spanID: string;
  startTime: number;
  tags: Tag[];
  traceID: string;
  traceSize: number;
  warnings?: string[];
};

export type Tag = {
  key: string;
  type: string;
  value: any;
};

export interface TracingUrlProvider {
  // Get a URL for all traces for a specific service in a time period
  AppSearchUrl: (service: string, bounds: BoundsInMilliseconds, tags: Record<string, string>, limit: number) => string;
  // Get a URL for comparing traces
  ComparisonUrl: (traceID: string, ...traceIDs: string[]) => string | undefined;
  // Get a URL to the home page of the tracing frontend
  HomeUrl: () => string;
  // Get a URL to a specific span in a specific trace
  SpanUrl: (span: SpanData) => string;
  // Get a URL to a specific trace
  TraceUrl: (trace: TraceData<any>) => string;

  readonly valid: boolean;
}

// Require that all properties are required and not null/undefined
export type ConcreteService = {
  name: string;
};

export const TEMPO = 'tempo';
export const GRAFANA = 'grafana';
export const JAEGER = 'jaeger';
