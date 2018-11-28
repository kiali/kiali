export interface Layout {
  name: string;
}

export enum EdgeLabelMode {
  HIDE = 'hide',
  TRAFFIC_RATE_PER_SECOND = 'trafficRatePerSecond',
  REQUESTS_PERCENT_OF_TOTAL = 'requestsPercentOfTotal',
  RESPONSE_TIME_95TH_PERCENTILE = 'responseTime95thPercentile'
}
