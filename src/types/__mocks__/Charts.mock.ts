import seedrandom from 'seedrandom';
import { ChartModel, SpanValue } from 'types/Dashboards';
import { Datapoint, Labels, Metric } from 'types/Metrics';
import { LabelsInfo } from 'utils/TimeSeriesUtils';
import { makeLegend, VCLine, RichDataPoint, LineInfo } from 'types/VictoryChartInfo';

const t0 = 1556802000;
const increment = 60;

export const biggerTimeWindow: [Date, Date] = [new Date((t0 - 10 * 60) * 1000), new Date((t0 + 10 * 60) * 1000)];
type Def = { name: string; stat?: string; labels?: Labels };

export const genSeries = (defs: Def[]): Metric[] => {
  return defs.map(def => ({ datapoints: genSingle(0, 50), name: def.name, stat: def.stat, labels: def.labels || {} }));
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

export const generateRandomMetricChart = (
  title: string,
  names: string[],
  spans: SpanValue,
  rowSpans?: SpanValue | undefined,
  seed?: string
): ChartModel => {
  return generateRandomMetricChartWithLabels(
    title,
    names.map(n => ({ name: n })),
    spans,
    rowSpans,
    seed
  );
};

export const generateRandomScatterChart = (
  title: string,
  names: string[],
  spans: SpanValue,
  rowSpans?: SpanValue | undefined,
  seed?: string
): ChartModel => {
  if (seed) {
    seedrandom(seed, { global: true });
  }
  return {
    name: title,
    unit: 'seconds',
    chartType: 'scatter',
    spans,
    rowSpans,
    metrics: genSeries(names.map(n => ({ name: n }))),
    startCollapsed: false
  };
};

export const generateRandomMetricChartWithLabels = (
  title: string,
  defs: Def[],
  spans: SpanValue,
  rowSpans?: SpanValue | undefined,
  seed?: string
): ChartModel => {
  if (seed) {
    seedrandom(seed, { global: true });
  }
  return {
    name: title,
    unit: 'bytes',
    spans,
    rowSpans,
    metrics: genSeries(defs),
    startCollapsed: false
  };
};

export const generateRandomHistogramChart = (
  title: string,
  spans: SpanValue,
  rowSpans?: SpanValue | undefined,
  seed?: string
): ChartModel => {
  if (seed) {
    seedrandom(seed, { global: true });
  }
  const histo = [
    {
      datapoints: genSingle(90, 100),
      name: title,
      stat: '0.99',
      labels: {}
    },
    {
      datapoints: genSingle(80, 25),
      name: title,
      stat: '0.95',
      labels: {}
    },
    {
      datapoints: genSingle(25, 15),
      name: title,
      stat: '0.5',
      labels: {}
    },
    {
      datapoints: genSingle(0, 50),
      name: title,
      stat: 'avg',
      labels: {}
    }
  ];
  return {
    name: title,
    unit: 'bitrate',
    spans,
    rowSpans,
    metrics: histo,
    startCollapsed: false
  };
};

export const generateRandomForOverlay = (): Datapoint[] => {
  return genSingle(0, 50).map(pair => [pair[0], pair[1] / 100]);
};

export const empty: ChartModel = {
  name: 'Empty metric chart',
  unit: 'bytes',
  spans: 6,
  metrics: [],
  startCollapsed: false
};

export const error: ChartModel = {
  name: 'Chart with error',
  unit: 'bytes',
  spans: 6,
  metrics: [],
  error: 'Unable to fetch metrics',
  startCollapsed: false
};

export const metric: ChartModel = {
  name: 'Metric chart',
  unit: 'bytes',
  spans: 6,
  metrics: [
    {
      datapoints: [
        [t0, 50.4],
        [t0 + increment, 48.2],
        [t0 + 2 * increment, 42.0]
      ],
      name: 'Metric chart',
      labels: {}
    }
  ],
  startCollapsed: false
};

export const histogram: ChartModel = {
  name: 'Histogram chart',
  unit: 'bytes',
  spans: 6,
  metrics: [
    {
      datapoints: [
        [t0, 50.4],
        [t0 + increment, 48.2],
        [t0 + 2 * increment, 42.0]
      ],
      name: 'Metric chart',
      stat: 'avg',
      labels: {}
    },
    {
      datapoints: [
        [t0, 150.4],
        [t0 + increment, 148.2],
        [t0 + 2 * increment, 142.0]
      ],
      name: 'Metric chart',
      stat: '0.99',
      labels: {}
    }
  ],
  startCollapsed: false
};

export const emptyLabels: LabelsInfo = {
  values: new Map()
};

export const labelsWithPrettifier: LabelsInfo = {
  values: new Map([
    [
      'code',
      {
        '200': true,
        '204': true,
        foobar: true,
        foobaz: false
      }
    ]
  ]),
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
  metrics: [
    {
      datapoints: [[0, 0]],
      name: 'Metric',
      labels: { code: '200' }
    },
    {
      datapoints: [[0, 0]],
      name: 'Metric',
      labels: { code: '204' }
    },
    {
      datapoints: [[0, 0]],
      name: 'Metric',
      labels: { code: 'foobar' }
    },
    {
      datapoints: [[0, 0]],
      name: 'Metric',
      labels: { code: 'foobaz' }
    }
  ],
  startCollapsed: false
};

export const genDates = (n: number): Date[] => {
  const step = 10000;
  const first = Date.now() - n * step;
  const dates: Date[] = [];
  for (let i = 0; i < n; i++) {
    dates.push(new Date(first + i * step));
  }
  return dates;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const buildLine = (info: LineInfo, xs: any[], values: number[], more?: any[]): VCLine<RichDataPoint> => {
  return {
    datapoints: values.map((v, i) => {
      return {
        x: xs[i],
        y: v,
        ...info,
        ...more?.[i]
      };
    }),
    legendItem: makeLegend(info.name, info.color),
    color: info.color
  };
};
