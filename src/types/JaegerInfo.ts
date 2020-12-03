/*
 Jaeger types are exported from https://github.com/jaegertracing/jaeger-ui/blob/5af9ed27c5c95031ca2c926902b51dc392413a09/packages/jaeger-ui/src/types/trace.tsx
*/

import { Target } from './MetricsOptions';

export interface JaegerInfo {
  enabled: boolean;
  integration: boolean;
  url: string;
  namespaceSelector: boolean;
  whiteListIstioSystem: string[];
}

export type KeyValuePair = {
  key: string;
  type: string;
  value: any;
};

export type Log = {
  timestamp: number;
  fields: Array<KeyValuePair>;
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
  spanID: string;
  traceID: string;
  processID: string;
  operationName: string;
  startTime: number;
  duration: number;
  logs: Array<Log>;
  tags?: Array<KeyValuePair>;
  references?: Array<SpanReference>;
  warnings?: Array<string> | null;
};

export type Span = SpanData & {
  depth: number;
  hasChildren: boolean;
  process: Process;
  relativeStartTime: number;
  tags: NonNullable<SpanData['tags']>;
  references: NonNullable<SpanData['references']>;
  warnings: NonNullable<SpanData['warnings']>;
};

export type RichSpanData = Span & {
  type: 'envoy' | 'http' | 'tcp' | 'unknown';
  component: string;
  namespace: string;
  app: string;
  linkToApp?: string;
  workload?: string;
  pod?: string;
  linkToWorkload?: string;
  info: OpenTracingBaseInfo;
};

export type OpenTracingBaseInfo = {
  component?: string;
  hasError: boolean;
};

export type OpenTracingHTTPInfo = OpenTracingBaseInfo & {
  statusCode?: number;
  url?: string;
  method?: string;
  direction?: 'inbound' | 'outbound';
};

export type OpenTracingTCPInfo = OpenTracingBaseInfo & {
  topic?: string;
  peerAddress?: string;
  peerHostname?: string;
  direction?: 'inbound' | 'outbound';
};

export type EnvoySpanInfo = OpenTracingHTTPInfo & {
  responseFlags?: string;
  peer?: Target;
};

export type TraceData = {
  processes: Record<string, Process>;
  traceID: string;
};

export type JaegerTrace = TraceData & {
  duration: number;
  endTime: number;
  spans: RichSpanData[];
  startTime: number;
  traceName: string;
  services: { name: string; numberOfSpans: number }[];
};

export type JaegerError = {
  code?: number;
  msg: string;
  traceID?: string;
};

export type JaegerResponse = {
  data: JaegerTrace[] | null;
  errors: JaegerError[];
  jaegerServiceName: string;
};

export type JaegerSingleResponse = {
  data: JaegerTrace | null;
  errors: JaegerError[];
};
