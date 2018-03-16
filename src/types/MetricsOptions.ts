interface MetricsOptions {
  rateInterval: string;
  duration: number;
  step: number;
  filterLabels: [string, string][];
  byLabelsIn: string[];
  byLabelsOut: string[];
}

export default MetricsOptions;
