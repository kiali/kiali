export interface LegendInfo {
  height: number;
  itemsPerRow: number;
  fontSizeLabels: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Style = any;

export type VCDataPoint = {
  name: string;
  x: number | Date | string;
  y: number;
  y0?: number;
  style?: Style;
};

export type LineInfo = {
  name: string;
  color: string;
  unit?: string;
  symbol?: string;
  size?: number;
  scaleFactor?: number;
};

export type RichDataPoint = VCDataPoint & LineInfo;

export type BucketDataPoint = {
  name: string;
  start: number | Date;
  end: number | Date;
  x: number | Date;
  y: number[];
  style?: Style;
};
export type RawOrBucket<T extends LineInfo> = T & (VCDataPoint | BucketDataPoint);

export type LegendItem = {
  name: string;
  symbol: { fill: string; type?: string };
};

// Create a legend object recognized by Victory. "Type" is optional (default is a square), it refers to a shape ('circle', 'star', etc.)
export const makeLegend = (name: string, color: string, type?: string): LegendItem => {
  return {
    name: name,
    symbol: {
      fill: color,
      type: type
    }
  };
};

export type VCLine<T extends RichDataPoint> = {
  datapoints: T[];
  color?: string;
  legendItem: LegendItem;
};

export type VCLines<T extends RichDataPoint> = VCLine<T>[];
