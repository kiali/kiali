export interface LegendInfo {
  height: number;
  itemsPerRow: number;
}

export type VCDataPoint = any & {
  name: string;
  x: number | Date;
  y: number;
};

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

export type VCLine = {
  datapoints: VCDataPoint[];
  color?: string;
  legendItem: LegendItem;
};

export type VCLines = VCLine[];
