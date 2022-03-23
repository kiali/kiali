import { DashboardModel } from 'types/Dashboards';
import seedrandom from 'seedrandom';
import {
  generateRandomMetricChart,
  generateRandomMetricChartWithLabels,
  generateRandomHistogramChart,
  generateRandomScatterChart
} from './Charts.mock';

export const generateRandomDashboard = (title: string, seed?: string): DashboardModel => {
  if (seed) {
    seedrandom(seed, { global: true });
  }
  return {
    title: title,
    charts: [
      generateRandomMetricChart('Single metric', ['chocolate'], 4),
      generateRandomMetricChartWithLabels(
        'Single metric with labels',
        [{ name: 'apples', labels: { color: 'green', size: 'big' } }],
        4
      ),
      generateRandomHistogramChart('Histogram', 4),
      generateRandomMetricChart('Several metrics', ['dogs', 'cats', 'birds'], 6),
      generateRandomMetricChartWithLabels(
        'Several metrics with labels',
        [
          { name: 'apples', labels: { color: 'green', size: 'big' } },
          { name: 'oranges', labels: { color: 'orange', size: 'small' } },
          { name: 'bananas', labels: { color: 'yellow', size: 'medium' } }
        ],
        6
      ),
      { name: 'empty 1', unit: 'bytes', spans: 6, metrics: [], startCollapsed: false },
      { name: 'empty 2', unit: 'bytes', spans: 6, metrics: [], startCollapsed: false },
      {
        name: 'error 1',
        unit: 'bytes',
        spans: 6,
        metrics: [],
        startCollapsed: false,
        error: 'Unexpected error occurred ... blah blah blah'
      },
      {
        name: 'error 2',
        unit: 'bytes',
        spans: 6,
        metrics: [],
        startCollapsed: false,
        error: 'Unexpected error occurred ... blah blah blah'
      },
      generateRandomMetricChart(
        'Best animal++',
        [
          'dogs',
          'cats',
          'birds',
          "stunning animal with very very long name that you've never about",
          'mermaids',
          'escherichia coli',
          'wohlfahrtiimonas',
          'Chuck Norris'
        ],
        4
      ),
      generateRandomMetricChart(
        'Best fruit++',
        ['apples', 'oranges', 'bananas', 'peaches', 'peers', 'cherries', 'leetchies', 'pineapple'],
        4
      ),
      generateRandomScatterChart(
        'Best traces++',
        ['apples', 'oranges', 'bananas', 'peaches', 'peers', 'cherries', 'leetchies', 'pineapple'],
        4
      ),
      { ...generateRandomMetricChart('With x-axis as series', ['dogs', 'cats', 'birds'], 6), xAxis: 'series' },
      {
        ...generateRandomMetricChart(
          'Bars with x-axis as series',
          ['apples', 'oranges', 'bananas', 'peaches', 'peers', 'cherries', 'leetchies', 'pineapple'],
          6
        ),
        xAxis: 'series',
        chartType: 'bar'
      }
    ],
    aggregations: [],
    externalLinks: [],
    rows: 2
  };
};

export const emptyDashboard: DashboardModel = {
  title: 'Empty dashboard',
  charts: [],
  aggregations: [],
  externalLinks: [],
  rows: 2
};
