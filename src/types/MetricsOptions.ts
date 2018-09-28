interface MetricsOptions {
  rateInterval?: string;
  rateFunc?: string;
  queryTime?: string;
  duration?: number;
  step?: number;
  version?: string;
  filters?: string[];
  quantiles?: string[];
  avg?: boolean;
  byLabelsIn?: string[];
  byLabelsOut?: string[];
}

export default MetricsOptions;
