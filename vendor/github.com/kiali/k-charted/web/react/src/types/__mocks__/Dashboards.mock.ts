import { DashboardModel } from '../Dashboards';
import seedrandom from 'seedrandom';
import { generateRandomMetricChart, generateRandomHistogramChart } from './Charts.mock';

export const generateRandomDashboard = (title: string, seed?: string): DashboardModel => {
  if (seed) {
    seedrandom(seed, { global: true });
  }
  return {
    title: title,
    charts: [
      generateRandomMetricChart('Best animal', ['dogs', 'cats', 'birds']),
      generateRandomMetricChart('Best fruit', ['apples', 'oranges', 'bananas']),
      generateRandomHistogramChart('Animal histogram'),
      generateRandomHistogramChart('Fruit histogram')
    ],
    aggregations: []
  };
};

export const emptyDashboard: DashboardModel = {
  title: 'Empty dashboard',
  charts: [],
  aggregations: []
};
