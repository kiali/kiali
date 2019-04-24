import { ChartModel } from '../Dashboards';
import { TimeSeries } from '../Metrics';
import seedrandom from 'seedrandom';

const t0 = 1556802000;
const increment = 60;

const genSeries = (names: string[]): TimeSeries[] => {
  return names.map(name => {
    return {
      values: genSingle(0, 50),
      labelSet: { lbl: name }
    };
  });
};

const genSingle = (offset: number, entropy: number): [number, number][] => {
  const values: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const x = t0 + increment * i;
    const y = offset + Math.floor(Math.random() * entropy);
    values.push([x, y]);
  }
  return values;
};

export const generateRandomMetricChart = (title: string, names: string[], seed?: string): ChartModel => {
  if (seed) {
    seedrandom(seed, { global: true });
  }
  return {
    name: title,
    unit: 'bytes',
    spans: 6,
    metric: genSeries(names)
  };
};

export const generateRandomHistogramChart = (title: string, seed?: string): ChartModel => {
  if (seed) {
    seedrandom(seed, { global: true });
  }
  const histo = {
    avg: [{
      values: genSingle(0, 50),
      labelSet: {}
    }],
    '0.5': [{
      values: genSingle(25, 15),
      labelSet: {}
    }],
    '0.95': [{
      values: genSingle(80, 25),
      labelSet: {}
    }],
    '0.99': [{
      values: genSingle(90, 100),
      labelSet: {}
    }]
  };
  return {
    name: title,
    unit: 'bitrate',
    spans: 6,
    histogram: histo
  };
};

export const empty: ChartModel = {
  name: 'Empty metric chart',
  unit: 'bytes',
  spans: 6,
  metric: []
};

export const error: ChartModel = {
  name: 'Chart with error',
  unit: 'bytes',
  spans: 6,
  metric: [],
  error: 'Unable to fetch metrics'
};

export const metric: ChartModel = {
  name: 'Metric chart',
  unit: 'bytes',
  spans: 6,
  metric: [{
    values: [[t0, 50.4], [t0 + increment, 48.2], [t0 + 2 * increment, 42.0]],
    labelSet: {}
  }]
};

export const histogram: ChartModel = {
  name: 'Histogram chart',
  unit: 'bytes',
  spans: 6,
  histogram: {
    avg: [{
      values: [[t0, 50.4], [t0 + increment, 48.2], [t0 + 2 * increment, 42.0]],
      labelSet: {}
    }],
    '0.99': [{
      values: [[t0, 150.4], [t0 + increment, 148.2], [t0 + 2 * increment, 142.0]],
      labelSet: {}
    }]
  }
};
