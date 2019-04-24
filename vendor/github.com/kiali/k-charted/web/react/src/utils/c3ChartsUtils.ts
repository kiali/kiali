import { TimeSeries, Histogram } from '../types/Metrics';
import { AllPromLabelsValues } from '../types/Labels';
import { filterAndNameMetric, filterAndNameHistogram } from './timeSeriesUtils';
import { ChartModel } from '../types/Dashboards';

export interface C3ChartData {
  x: string;
  columns: any[][];
  unload?: string[];
}

const histogramToC3Columns = (histogram: Histogram) => {
  const stats = Object.keys(histogram);
  if (stats.length === 0 || histogram[stats[0]].length === 0) {
    return [['x'], ['']];
  }

  let series = [(['x'] as any[]).concat(histogram[stats[0]][0].values.map(dp => dp[0] * 1000))];
  stats.forEach(stat => {
    const statSeries = histogram[stat].map(mat => {
      return [mat.name as any].concat(mat.values.map(dp => dp[1]));
    });
    series = series.concat(statSeries);
  });
  return series;
};

const toC3Columns = (matrix?: TimeSeries[], title?: string) => {
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
};

const metricsDataSupplier = (chartName: string, metrics: TimeSeries[], labelValues: AllPromLabelsValues): () => C3ChartData => {
  return () => {
    const filtered = filterAndNameMetric(chartName, metrics, labelValues);
    return {
      x: 'x',
      columns: toC3Columns(filtered)
    };
  };
};

const histogramDataSupplier = (histogram: Histogram, labelValues: AllPromLabelsValues): () => C3ChartData => {
  return () => {
    const filtered = filterAndNameHistogram(histogram, labelValues);
    return {
      x: 'x',
      columns: histogramToC3Columns(filtered)
    };
  };
};

export const getDataSupplier = (chart: ChartModel, labelValues: AllPromLabelsValues): (() => C3ChartData) | undefined => {
  if (chart.metric) {
    return metricsDataSupplier(chart.name, chart.metric, labelValues);
  } else if (chart.histogram) {
    return histogramDataSupplier(chart.histogram, labelValues);
  }
  return undefined;
};
