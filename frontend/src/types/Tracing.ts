import { BoundsInMilliseconds } from 'types/Common';

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
  AppSearchUrl: (service: string, bounds: BoundsInMilliseconds, tags: Record<string, string>, limit: number) => string;
  ComparisonUrl: (traceID: string, ...traceIDs: string[]) => string | undefined;
  HomeUrl: () => string;
  SpanUrl: (traceID: string, spanID: string) => string;
  TraceUrl: (traceID: string) => string;

  readonly valid: boolean;
}

// Require that all properties are required and not null/undefined
export type ConcreteService = {
  frontendProvider: string;
  frontendProviderConfig: Record<string, string>;
  name: string;
};

export const TEMPO = 'tempo';
