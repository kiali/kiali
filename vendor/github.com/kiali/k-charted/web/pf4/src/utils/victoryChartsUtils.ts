import { ChartLineProps } from '@patternfly/react-charts';
import { TimeSeries, Histogram } from '../../../common/types/Metrics';
import { VictoryChartInfo, LegendInfo } from '../types/VictoryChartInfo';
import { filterAndNameMetric, filterAndNameHistogram, LabelsInfo } from '../../../common/utils/timeSeriesUtils';
import { ChartModel } from '../../../common/types/Dashboards';

const toVCLines = (ts: TimeSeries[], unit: string): VictoryChartInfo => {
  return {
    rawLegend: ts.map(line => line.name!),
    series: ts.map(line => {
      return line.values.map(dp => {
        return {
          name: line.name!,
          x: new Date(dp[0] * 1000) as any,
          y: Number(dp[1]),
          unit: unit
        };
      }).filter(dp => !isNaN(dp.y));
    })
  };
};

const histogramToVCLines = (histogram: Histogram, unit: string): VictoryChartInfo => {
  // Flat-map histo_stat * series
  const stats = Object.keys(histogram);
  let series: ChartLineProps[][] = [];
  let legend: string[] = [];
  stats.forEach(statName => {
    const innerInfo = toVCLines(histogram[statName], unit);
    series = series.concat(innerInfo.series);
    legend = legend.concat(innerInfo.rawLegend);
  });
  return {
    rawLegend: legend,
    series: series
  };
};

const metricsDataSupplier = (chartName: string, metrics: TimeSeries[], labels: LabelsInfo, unit: string): () => VictoryChartInfo => {
  return () => {
    const filtered = filterAndNameMetric(chartName, metrics, labels);
    return toVCLines(filtered, unit);
  };
};

const histogramDataSupplier = (histogram: Histogram, labels: LabelsInfo, unit: string): () => VictoryChartInfo => {
  return () => {
    const filtered = filterAndNameHistogram(histogram, labels);
    return histogramToVCLines(filtered, unit);
  };
};

export const getDataSupplier = (chart: ChartModel, labels: LabelsInfo): (() => VictoryChartInfo) => {
  if (chart.metric) {
    return metricsDataSupplier(chart.name, chart.metric, labels, chart.unit);
  } else if (chart.histogram) {
    return histogramDataSupplier(chart.histogram, labels, chart.unit);
  }
  return () => ({ rawLegend: [], series: [] });
};

export const buildLegend = (rawLegend: string[], chartWidth: number): LegendInfo => {
  // Very arbitrary rules to try to get a good-looking legend. There's room for enhancement.
  const items = rawLegend.map(it => ({ name: it }));
  // Box size in pixels per item
  // Note that it is based on longest string in characters, not pixels
  let boxSize = 110;
  const longest = items.map(it => it.name).reduce((a, b) => a.length > b.length ? a : b, '').length;
  if (longest >= 30) {
    boxSize = 400;
  } else if (longest >= 20) {
    boxSize = 300;
  } else if (longest >= 10) {
    boxSize = 200;
  }
  const itemsPerRow = Math.max(1, Math.floor(chartWidth / boxSize));
  const nbRows = Math.ceil(items.length / itemsPerRow);

  return {
    height: 15 + 30 * nbRows,
    itemsPerRow: itemsPerRow,
    items: items
  };
};
