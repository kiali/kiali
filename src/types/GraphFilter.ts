export interface Layout {
  name: string;
}

export interface Duration {
  value: number;
}

export interface PollInterval {
  value: number;
}

export enum EdgeLabelMode {
  HIDE = 'hide',
  REQUESTS_PER_SECOND = 'requestsPerSecond',
  REQUESTS_PERCENT_OF_TOTAL = 'requestsPercentOfTotal',
  LATENCY_95TH_PERCENTILE = 'latency95thPercentile'
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
