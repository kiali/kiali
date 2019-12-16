export interface LegendInfo {
  height: number;
  itemsPerRow: number;
}

export type VCDataPoint = {
  name: string;
  x: number | Date;
  y: number;
};

export type LegendItem = {
  name: string;
  symbol: { fill: string; type?: string };
};

export type VCLine = {
  datapoints: VCDataPoint[];
  color?: string;
  legendItem: LegendItem;
};

export type VCLines = VCLine[];
