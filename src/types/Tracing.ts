export type TracingQuery = {
  startMicros: number;
  endMicros?: number;
  // TODO: tags?
  // tags?: {[key: string]: string}
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
  // TODO: more meta-data? logs ...
};

export type Tag = {
  key: string;
  type: string;
  value: any;
};
