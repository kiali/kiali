import { Datapoint, Metric } from 'types/Metrics';
import {
  VCLines,
  VCLine,
  LegendItem,
  VCDataPoint,
  makeLegend,
  RichDataPoint,
  LineInfo,
  BucketDataPoint
} from 'types/VictoryChartInfo';
import { filterAndRenameMetric, LabelsInfo } from 'utils/TimeSeriesUtils';
import { ChartModel, XAxisType } from 'types/Dashboards';
import { Overlay, OverlayInfo } from 'types/Overlay';

export const toVCDatapoints = (dps: Datapoint[], name: string): VCDataPoint[] => {
  return dps
    .map(dp => {
      return {
        name: name,
        x: new Date(dp[0] * 1000),
        y: Number(dp[1])
      };
    })
    .filter(dp => !isNaN(dp.y));
};

export const toVCSinglePoint = (dps: Datapoint[], name: string): VCDataPoint[] => {
  const last = dps.filter(dp => !isNaN(dp[1])).reduce((p, c) => (c[0] > p[0] ? c : p));
  if (last) {
    return [
      {
        name: name,
        time: new Date(last[0] * 1000),
        x: 0, // placeholder
        y: Number(last[1])
      } as VCDataPoint
    ];
  }
  return [];
};

const buildVCLine = <T extends LineInfo>(dps: VCDataPoint[], lineInfo: T): VCLine<VCDataPoint & T> => {
  const datapoints: (VCDataPoint & T)[] = dps.map(dp => ({ ...lineInfo, ...dp }));
  const legendItem: LegendItem = makeLegend(lineInfo.name, lineInfo.color, lineInfo.symbol);
  return {
    datapoints: datapoints,
    legendItem: legendItem,
    color: lineInfo.color
  };
};

export const toVCLine = (dps: Datapoint[], name: string, color: string): VCLine<RichDataPoint> => {
  return buildVCLine(toVCDatapoints(dps, name), { name: name, color: color });
};

export const toVCLines = (
  metrics: Metric[],
  unit: string,
  colors: string[],
  xAxis: XAxisType = 'time'
): VCLines<RichDataPoint> => {
  return metrics.map((line, i) => {
    const color = colors[i % colors.length];
    const dps =
      xAxis === 'time' ? toVCDatapoints(line.datapoints, line.name) : toVCSinglePoint(line.datapoints, line.name);
    return buildVCLine(dps, { name: line.name, unit: unit, color: color });
  });
};

export const getDataSupplier = (
  chart: ChartModel,
  labels: LabelsInfo,
  colors: string[]
): (() => VCLines<RichDataPoint>) => {
  return () => {
    const filtered = filterAndRenameMetric(chart.metrics, labels);
    return toVCLines(filtered, chart.unit, colors, chart.xAxis || 'time');
  };
};

// toBuckets accumulates datapoints into bukets.
// The result is still a (smaller) list of VCDataPoints, but with Y value being an array of values instead of a single value.
// This data structure is required by VictoryBoxPlot object.
export const toBuckets = <T extends LineInfo>(
  nbuckets: number,
  datapoints: VCDataPoint[],
  lineInfo: T,
  timeWindow?: [Date, Date]
): (T & BucketDataPoint)[] => {
  if (datapoints.length === 0) {
    return [];
  }
  // xBuilder will preserve X-axis type when building buckets (either dates or raw numbers)
  const xBuilder: (x: number) => number | Date = typeof datapoints[0].x === 'object' ? x => new Date(x) : x => x;

  let min = 0;
  let max = 0;
  if (timeWindow) {
    min = timeWindow[0].getTime();
    max = timeWindow[1].getTime();
  } else {
    const times = datapoints.map(dp => Number(dp.x));
    min = Math.min(...times);
    max = Math.max(...times);
  }
  const bucketSize = (1 + max - min) / nbuckets;
  // Create $nbuckets buckets at regular intervals with preset / static content $dpInject
  const buckets: (T & BucketDataPoint)[] = Array.from({ length: nbuckets }, (_, idx) => {
    const start = Math.floor(min + idx * bucketSize);
    const end = Math.floor(start + bucketSize - 1);
    return {
      ...lineInfo,
      start: xBuilder(start),
      end: xBuilder(end),
      x: xBuilder(Math.floor(start + bucketSize / 2)),
      y: []
    };
  });
  datapoints.forEach(dp => {
    // Get bucket index from timestamp
    const idx = Math.floor((Number(dp.x) - min) / bucketSize);
    // This index might be out of range when a timeWindow is provided, so protect against that
    if (idx >= 0 && idx < buckets.length) {
      buckets[idx].y.push(dp.y);
    }
  });
  return buckets.filter(b => b.y.length > 0);
};

export const toOverlay = <T extends LineInfo>(info: OverlayInfo<T>, dps: VCDataPoint[]): Overlay<T> => {
  return {
    info: info,
    vcLine: buildVCLine(dps, info.lineInfo)
  };
};
