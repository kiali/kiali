import { TimeSeries, Datapoint, NamedTimeSeries } from '../../../common/types/Metrics';
import { VCLines, LegendInfo, VCLine, LegendItem, VCDataPoint, makeLegend } from '../types/VictoryChartInfo';
import { filterAndNameMetric, LabelsInfo } from '../../../common/utils/timeSeriesUtils';
import { ChartModel } from '../../../common/types/Dashboards';
import { Overlay, OverlayInfo } from '../types/Overlay';

export const toVCDatapoints = (dps: Datapoint[], name: string): VCDataPoint[] => {
  return dps.map(dp => {
      return {
        name: name,
        x: new Date(dp[0] * 1000) as any,
        y: Number(dp[1]),
      };
    })
    .filter(dp => !isNaN(dp.y));
};

export const toVCLine = (dps: VCDataPoint[], dpInject: { unit: string, color: string } & any): VCLine => {
  const datapoints = dps.map(dp => ({ ...dpInject, ...dp }));
  const legendItem: LegendItem = makeLegend(dpInject.name, dpInject.color, dpInject.symbol);
  return {
    datapoints: datapoints,
    legendItem: legendItem,
    color: dpInject.color
  };
};

let colorsIdx = 0;
const toVCLines = (ts: NamedTimeSeries[], unit: string, colors: string[]): VCLines => {
  return ts.map(line => {
    const color = colors[colorsIdx % colors.length];
    colorsIdx++;
    return toVCLine(toVCDatapoints(line.values, line.name), { name: line.name, unit: unit, color: color });
  });
};

export const getDataSupplier = (chart: ChartModel, labels: LabelsInfo, colors: string[]): (() => VCLines) => {
  return () => {
    colorsIdx = 0;
    const filtered = filterAndNameMetric(chart.metrics, labels);
    return toVCLines(filtered, chart.unit, colors);
  };
};

export const buildLegendInfo = (items: LegendItem[], chartWidth: number): LegendInfo => {
  // Very arbitrary rules to try to get a good-looking legend. There's room for enhancement.
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
    itemsPerRow: itemsPerRow
  };
};

export const toOverlay = (info: OverlayInfo, dps: VCDataPoint[]): Overlay => {
  const dpInject = {
    name: info.title,
    unit: info.unit,
    color: info.color,
    symbol: info.symbol,
    size: info.size
  };
  return {
    info: info,
    vcLine: toVCLine(dps, dpInject)
  };
};

const createDomainConverter = (dps: VCDataPoint[], numFunc: (dp: VCDataPoint) => number) => {
  // Clicked position in screen coordinate (relative to svg element) are transformed in domain-data coordinate
  //  This is assuming a linear scale and no data padding
  const values = dps.map(dp => numFunc(dp));
  const min = Math.min(...values);
  const max = Math.max(...values);
  return {
    // Convert screen coords into domain coords
    convert: (pxlPos: number, pxlSize: number) => min + (max - min) * pxlPos / pxlSize,
    // Normalize a given distance relatively to the min/max domain
    normalize: (dist: number) => dist / (max - min)
  };
};

// findClosestDatapoint will search in all datapoints which is the closer to the given position in pixels
//  This is done by converting screen coords into domain coords, then finding the least distance between this converted point and all the datapoints.
export const findClosestDatapoint = (flatDP: VCDataPoint[], x: number, y: number, width: number, height: number): VCDataPoint | undefined => {
  if (width <= 0 || height <= 0 || flatDP.length === 0) {
    return undefined;
  }
  const xNumFunc: (dp: VCDataPoint) => number = typeof flatDP[0].x === 'object' ? dp => dp.x.getTime() : dp => dp.x;
  const xConv = createDomainConverter(flatDP, xNumFunc);
  const yConv = createDomainConverter(flatDP,  dp => dp.y);
  const clickedX = xConv.convert(x, width);
  const clickedY = yConv.convert(height - y /* reversed y coords */, height);

  return flatDP.reduce((p: VCDataPoint, c: VCDataPoint) => {
    if (p === null) {
      return c;
    }
    const dist = xConv.normalize(Math.abs((clickedX - xNumFunc(c)))) + yConv.normalize(Math.abs(clickedY - c.y));
    const prevDist = xConv.normalize(Math.abs((clickedX - xNumFunc(p)))) + yConv.normalize(Math.abs(clickedY - p.y));
    return dist < prevDist ? c : p;
  });
};
