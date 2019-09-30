import { ChartModel } from '../../../../common/types/Dashboards';
import { TimeSeries } from '../../../../common/types/Metrics';
import seedrandom from 'seedrandom';
import { LabelsInfo } from '../../../../common/utils/timeSeriesUtils';

const t0 = 1556802000;
const increment = 60;

const genSeries = (names: string[]): TimeSeries[] => {
  return names.map((name, idx) => {
    // Set some special x ranges for some timeseries
    const xrange: [number, number] = idx === 0 ? [1, 10] : idx === 2 ? [2, 8] : [0, 10];
    return {
      values: genSingle(xrange, 0, 50),
      labelSet: { lbl: name }
    };
  });
};

const genSingle = (xrange: [number, number], yoffset: number, entropy: number): [number, number][] => {
  const values: [number, number][] = [];
  for (let i = xrange[0]; i < xrange[1]; i++) {
    const x = t0 + increment * i;
    const y = yoffset + Math.floor(Math.random() * entropy);
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
      values: genSingle([0, 10], 0, 50),
      labelSet: {}
    }],
    '0.5': [{
      values: genSingle([0, 10], 25, 15),
      labelSet: {}
    }],
    '0.95': [{
      values: genSingle([0, 10], 80, 25),
      labelSet: {}
    }],
    '0.99': [{
      values: genSingle([0, 10], 90, 100),
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

export const emptyLabels: LabelsInfo = {
  values: new Map()
};

export const labelsWithPrettifier: LabelsInfo = {
  values: new Map([['code', {
    '200': true,
    '204': true,
    'foobar': true,
    'foobaz': false
  }]]),
  prettifier: (k: string, v: string): string => {
    if (k === 'code' && v === '200') {
      return 'OK';
    }
    if (k === 'code' && v === '204') {
      return 'No content';
    }
    return v;
  }
};

export const metricWithLabels: ChartModel = {
  name: 'Metric chart',
  unit: 'bytes',
  spans: 6,
  metric: [{
    values: [[0, 0]],
    labelSet: {'code': '200'}
  }, {
    values: [[0, 0]],
    labelSet: {'code': '204'}
  }, {
    values: [[0, 0]],
    labelSet: {'code': 'foobar'}
  }, {
    values: [[0, 0]],
    labelSet: {'code': 'foobaz'}
  }]
};
