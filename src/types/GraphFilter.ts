export interface Layout {
  name: string;
}

export enum EdgeLabelMode {
  NONE = 'noEdgeLabels',
  REQUESTS_PER_SECOND = 'requestsPerSecond',
  REQUESTS_PERCENTAGE = 'requestsPercentage',
  RESPONSE_TIME_95TH_PERCENTILE = 'responseTime'
}
