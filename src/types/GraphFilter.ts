export interface Layout {
  name: string;
}

export interface Duration {
  value: number;
}

export enum EdgeLabelMode {
  NONE = 'NONE',
  REQUEST_RATE = 'REQUEST_RATE',
  LATENCY = 'LATENCY'
}

export namespace EdgeLabelMode {
  export const getValues: () => EdgeLabelMode[] = () =>
    Object.keys(EdgeLabelMode)
      .map(stringValue => EdgeLabelMode[stringValue])
      .filter(v => typeof v === 'string');
  export const fromString: (value: string, defaultValue?: EdgeLabelMode) => EdgeLabelMode = (value, defaultValue) => {
    if (value in EdgeLabelMode) {
      return EdgeLabelMode[value] as EdgeLabelMode;
    }
    if (!defaultValue) {
      throw TypeError(`${value} is not a EdgeLabelMode`);
    }

    return defaultValue;
  };
}
