import { DashboardModel } from '../../../../common/types/Dashboards';
import seedrandom from 'seedrandom';
import { generateRandomMetricChart, generateRandomMetricChartWithLabels, generateRandomHistogramChart, generateRandomScatterChart, genLabels } from './Charts.mock';

export const generateRandomDashboard = (title: string, seed?: string): DashboardModel => {
  if (seed) {
    seedrandom(seed, { global: true });
  }
  return {
    title: title,
    charts: [
      generateRandomMetricChart('Single metric', ['chocolate'], 4),
      generateRandomMetricChartWithLabels('Single metric with labels', [
        genLabels('apples', undefined, [['color', 'green'], ['size', 'big']])
      ], 4),
      generateRandomHistogramChart('Histogram', 4),
      generateRandomMetricChart('Several metrics', ['dogs', 'cats', 'birds'], 6),
      generateRandomMetricChartWithLabels('Several metrics with labels', [
        genLabels('apples', undefined, [['color', 'green'], ['size', 'big']]),
        genLabels('oranges', undefined, [['color', 'orange'], ['size', 'small']]),
        genLabels('bananas', undefined, [['color', 'yellow'], ['size', 'medium']])
      ], 6),
      { name: 'empty 1', unit: 'bytes', spans: 6, metrics: [] },
      { name: 'empty 2', unit: 'bytes', spans: 6, metrics: [] },
      { name: 'error 1', unit: 'bytes', spans: 6, metrics: [], error: 'Unexpected error occurred ... blah blah blah' },
      { name: 'error 2', unit: 'bytes', spans: 6, metrics: [], error: 'Unexpected error occurred ... blah blah blah' },
      generateRandomMetricChart('Best animal++', ['dogs', 'cats', 'birds', 'stunning animal with very very long name that you\'ve never about', 'mermaids', 'escherichia coli', 'wohlfahrtiimonas', 'Chuck Norris'], 4),
      generateRandomMetricChart('Best fruit++', ['apples', 'oranges', 'bananas', 'peaches', 'peers', 'cherries', 'leetchies', 'pineapple'], 4),
      generateRandomScatterChart('Best traces++', ['apples', 'oranges', 'bananas', 'peaches', 'peers', 'cherries', 'leetchies', 'pineapple'], 4),
    ],
    aggregations: [],
    externalLinks: []
  };
};

export const emptyDashboard: DashboardModel = {
  title: 'Empty dashboard',
  charts: [],
  aggregations: [],
  externalLinks: []
};
