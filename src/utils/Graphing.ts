import { TimeSeries, Datapoint } from '../types/Metrics';

export type VCDataPoint = {
  name: string;
  x: number | Date;
  y: number;
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
  toC3Columns(matrix?: TimeSeries[], title?: string) {
    if (!matrix || matrix.length === 0) {
      return [['x'], [title || '']];
    }

    // xseries are timestamps. Timestamps are taken from the first series and assumed
    // that all series have the same timestamps.
    let xseries: any = ['x'];
    xseries = xseries.concat(matrix[0].values.map(dp => dp[0] * 1000));

    // yseries are the values of each serie.
    const yseries: any[] = matrix.map(mat => {
      const serie: any = [title || mat.name];
      return serie.concat(mat.values.map(dp => dp[1]));
    });

    // timestamps + data is the format required by C3 (all concatenated: an array with arrays)
    return [xseries, ...yseries];
  },

  toVCLine(dps: Datapoint[], title: string, color?: string): VCLine {
    const datapoints = dps
      .map(dp => {
        return {
          name: title,
          x: new Date(dp[0] * 1000) as any,
          y: Number(dp[1])
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
