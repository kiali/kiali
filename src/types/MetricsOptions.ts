interface MetricsOptions {
  rateInterval?: string;
  rateFunc?: string;
  duration?: number;
  step?: number;
  version?: string;
  filters?: string[];
  byLabelsIn?: string[];
  byLabelsOut?: string[];
}

export default MetricsOptions;
