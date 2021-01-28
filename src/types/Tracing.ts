export type TracingQuery = {
  startMicros: number;
  endMicros?: number;
  tags?: string;
  limit?: number;
  minDuration?: string;
};

export type Span = {
  traceID: string;
  spanID: string;
  operationName: string;
  startTime: number;
  duration: number;
  tags: Tag[];
  warnings?: string[];
  traceSize: number;
};

export type Tag = {
  key: string;
  type: string;
  value: any;
};
