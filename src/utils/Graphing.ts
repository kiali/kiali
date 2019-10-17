import { TimeSeries, Datapoint } from '../types/Metrics';

export type VCDataPoint = {
  name: string;
  x: number | Date;
  y: number;
  color?: string;
};

type LegendItem = {
  name: string;
  symbol?: { fill?: string; type?: string };
};

export type VCLine = {
  datapoints: VCDataPoint[];
  color?: string;
  legendItem: LegendItem;
};

export type VCLines = VCLine[];

export default {
  toVCLine(dps: Datapoint[], title: string, color?: string): VCLine {
    const datapoints = dps
      .map(dp => {
        return {
          name: title,
          x: new Date(dp[0] * 1000) as any,
          y: Number(dp[1]),
          color: color
        };
      })
      .filter(dp => !isNaN(dp.y));
    const legendItem: LegendItem = { name: title };
    if (color) {
      legendItem.symbol = { fill: color };
    }
    return {
      datapoints: datapoints,
      legendItem: legendItem,
      color: color
    };
  },

  toVCLines(ts: TimeSeries[], colors?: string[], title?: string): VCLines {
    return ts.map((line, idx) => {
      const name = title || line.name || '';
      const color = colors ? colors[idx % colors.length] : undefined;
      return this.toVCLine(line.values, name, color);
    });
  }
};
