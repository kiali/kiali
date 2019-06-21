import { ChartLineProps } from '@patternfly/react-charts';
import { TimeSeries, Histogram } from '../types/Metrics';
import { VictoryChartInfo, VictoryChartLegendItem } from '../types/VictoryChartInfo';
import { filterAndNameMetric, filterAndNameHistogram } from './timeSeriesUtils';
import { ChartModel } from '../types/Dashboards';
import { AllPromLabelsValues } from '../types/Labels';

const toVCLines = (ts: TimeSeries[]): VictoryChartInfo => {
  return {
    legend: ts.map(line => ({ name: line.name! })),
    series: ts.map(line => {
      return line.values.map(dp => {
        return {
          name: line.name!,
          x: new Date(dp[0] * 1000) as any,
          y: dp[1]
        };
      });
    })
  };
};

const histogramToVCLines = (histogram: Histogram): VictoryChartInfo => {
  // Flat-map histo_stat * series
  const stats = Object.keys(histogram);
  let series: ChartLineProps[][] = [];
  let legend: VictoryChartLegendItem[] = [];
  stats.forEach(statName => {
    const innerInfo = toVCLines(histogram[statName]);
    series = series.concat(innerInfo.series);
    legend = legend.concat(innerInfo.legend);
  });
  return {
    legend: legend,
    series: series
  };
};

const metricsDataSupplier = (chartName: string, metrics: TimeSeries[], labelValues: AllPromLabelsValues): () => VictoryChartInfo => {
  return () => {
    const filtered = filterAndNameMetric(chartName, metrics, labelValues);
    return toVCLines(filtered);
  };
};

const histogramDataSupplier = (histogram: Histogram, labelValues: AllPromLabelsValues): () => VictoryChartInfo => {
  return () => {
    const filtered = filterAndNameHistogram(histogram, labelValues);
    return histogramToVCLines(filtered);
  };
};

export const getDataSupplier = (chart: ChartModel, labelValues: AllPromLabelsValues): (() => VictoryChartInfo) | undefined => {
  if (chart.metric) {
    return metricsDataSupplier(chart.name, chart.metric, labelValues);
  } else if (chart.histogram) {
    return histogramDataSupplier(chart.histogram, labelValues);
  }
  return undefined;
};
