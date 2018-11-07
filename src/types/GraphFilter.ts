export interface Layout {
  name: string;
}

export enum EdgeLabelMode {
  HIDE = 'hide',
  TRAFFIC_RATE_PER_SECOND = 'trafficRatePerSecond',
  REQUESTS_PERCENT_OF_TOTAL = 'requestsPercentOfTotal',
  RESPONSE_TIME_95TH_PERCENTILE = 'responseTime95thPercentile'
}

export namespace EdgeLabelMode {
  export const getValues: () => EdgeLabelMode[] = () =>
    Object.keys(EdgeLabelMode)
      .map(stringValue => EdgeLabelMode[stringValue])
      .filter(v => typeof v === 'string');
  export const fromString: (value: string, defaultValue?: EdgeLabelMode) => EdgeLabelMode = (value, defaultValue) => {
    const key = Object.keys(EdgeLabelMode).find(k => EdgeLabelMode[k] === value);
    if (key) {
      return EdgeLabelMode[key];
    }
    if (!defaultValue) {
      throw TypeError(`${value} is not a EdgeLabelMode`);
    }
    return defaultValue;
  };
}
