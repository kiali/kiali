export interface MetricsOptions {
  rateInterval: string;
  duration: string;
  step: string;
  filterLabels: Map<String, String>;
  byLabels: String[];
}
