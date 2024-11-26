/*
 Jaeger types are exported from https://github.com/jaegertracing/jaeger-ui/blob/5af9ed27c5c95031ca2c926902b51dc392413a09/packages/jaeger-ui/src/types/trace.tsx
*/

import { Target } from './MetricsOptions';

export type TracingStats = {
  hitRate: string;
  size: number;
};

export interface TracingInfo {
  enabled: boolean;
  integration: boolean;
  namespaceSelector: boolean;
  provider: string;
  stats?: TracingStats;
  url: string;
  whiteListIstioSystem: string[];
}

export type KeyValuePair = {
  key: string;
  type: string;
  value: any;
};

export type Log = {
  fields: Array<KeyValuePair>;
  timestamp: number;
};

export type SpanReference = {
  refType: 'CHILD_OF' | 'FOLLOWS_FROM';
  // eslint-disable-next-line no-use-before-define
  span: Span | null | undefined;
  spanID: string;
  traceID: string;
};

export type Process = {
  serviceName: string;
  tags: Array<KeyValuePair>;
};

export type SpanData = {
  duration: number;
  logs: Array<Log>;
  operationName: string;
  processID: string;
  references?: Array<SpanReference>;
  spanID: string;
  startTime: number;
  tags?: Array<KeyValuePair>;
  traceID: string;
  warnings?: Array<string> | null;
};

export type Span = SpanData & {
  depth: number;
  hasChildren: boolean;
  process: Process;
  references: NonNullable<SpanData['references']>;
  relativeStartTime: number;
  tags: NonNullable<SpanData['tags']>;
  warnings: NonNullable<SpanData['warnings']>;
};

export type RichSpanData = Span & {
  app: string;
  cluster?: string;
  component: string;
  info: OpenTracingBaseInfo;
  linkToApp?: string;
  linkToWorkload?: string;
  namespace: string;
  pod?: string;
  type: 'envoy' | 'http' | 'tcp' | 'unknown';
  workload?: string;
};

export type OpenTracingBaseInfo = {
  component?: string;
  hasError: boolean;
};

export type OpenTracingHTTPInfo = OpenTracingBaseInfo & {
  direction?: 'inbound' | 'outbound';
  method?: string;
  statusCode?: number;
  url?: string;
};

export type OpenTracingTCPInfo = OpenTracingBaseInfo & {
  direction?: 'inbound' | 'outbound';
  peerAddress?: string;
  peerHostname?: string;
  topic?: string;
};

export type EnvoySpanInfo = OpenTracingHTTPInfo & {
  peer?: Target;
  responseFlags?: string;
};

export type TraceData<S extends SpanData> = {
  matched?: number; // Tempo returns the number of total spans matched
  processes: Record<string, Process>;
  spans: S[];
  traceID: string;
};

export type JaegerTrace = TraceData<RichSpanData> & {
  duration: number;
  endTime: number;
  matched?: number; // Tempo returns the number of total spans matched
  services: { name: string; numberOfSpans: number }[];
  startTime: number;
  traceName: string;
};

export type TracingError = {
  code?: number;
  msg: string;
  traceID?: string;
};

export type TracingResponse = {
  data: JaegerTrace[] | null;
  errors: TracingError[];
  fromAllClusters: boolean;
  tracingServiceName: string;
};

export type TracingSingleResponse = {
  data: JaegerTrace | null;
  errors: TracingError[];
};
