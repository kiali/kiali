import { DashboardModel } from '../../../../common/types/Dashboards';
import seedrandom from 'seedrandom';
import { generateRandomMetricChart, generateRandomMetricChartWithLabels, generateRandomHistogramChart, generateRandomScatterChart } from './Charts.mock';

export const generateRandomDashboard = (title: string, seed?: string): DashboardModel => {
  if (seed) {
    seedrandom(seed, { global: true });
  }
  return {
    title: title,
    charts: [
      generateRandomMetricChart('Best animal', ['dogs', 'cats', 'birds'], 4),
      generateRandomMetricChartWithLabels('Best fruit', [{name: 'apples', labels: {color: 'green'}}, {name: 'oranges', labels: {color: 'orange'}}, {name: 'bananas', labels: {color: 'yellow'}}], 4),
      generateRandomHistogramChart('Histogram', 4),
      { name: 'empty 1', unit: 'bytes', spans: 6, metric: [] },
      { name: 'empty 2', unit: 'bytes', spans: 6, metric: [] },
      { name: 'error 1', unit: 'bytes', spans: 6, metric: [], error: 'Unexpected error occurred ... blah blah blah' },
      { name: 'error 2', unit: 'bytes', spans: 6, metric: [], error: 'Unexpected error occurred ... blah blah blah' },
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
