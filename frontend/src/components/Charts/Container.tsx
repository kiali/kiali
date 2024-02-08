import { DomainTuple } from 'victory-core';
import { format as d3Format } from 'd3-format';
import { getFormatter } from 'utils/Formatter';
import { RichDataPoint } from 'types/VictoryChartInfo';
import { VictoryVoronoiContainerProps } from 'victory-voronoi-container';

type BrushDomain = { x: DomainTuple; y: DomainTuple };

export type BrushHandlers = {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  onCleared?: (domain: BrushDomain, props: any) => void;
  onDomainChange?: (domain: BrushDomain, props: any) => void;
  onDomainChangeEnd?: (domain: BrushDomain, props: any) => void;
  /* eslint-enable @typescript-eslint/no-explicit-any */
};

const formatValue = (label: string, datum: RichDataPoint, value: number, y0?: number): string => {
  // Formats a value based on unit and scale factor.
  // Scale factor is usually undefined, except when a second axis is in use (then it's the ratio between first axis and second axis maxs)

  if (y0 !== undefined) {
    return (
      `${label}:` +
      ` source = ${getFormatter(
        d3Format,
        datum.unit!,
        true
      )(value / (datum.scaleFactor || 1))}; destination = ${getFormatter(
        d3Format,
        datum.unit!,
        true
      )(y0 / (datum.scaleFactor || 1))}`
    );
  }

  return `${label}: ${getFormatter(d3Format, datum.unit!, true)(value / (datum.scaleFactor || 1))}`;
};

export const getVoronoiContainerProps = (
  labelComponent: React.ReactElement,
  hideTooltip: () => boolean
): VictoryVoronoiContainerProps => {
  return {
    labels: obj => {
      if (obj.datum.hideLabel || hideTooltip()) {
        return '';
      }

      if (obj.datum._median !== undefined) {
        // Buckets display => datapoint is expected to have _median, _min, _max, _q1, _q3 stats
        const avg = obj.datum.y.reduce((s: number, y: number) => s + y, 0) / obj.datum.y.length;

        return `${obj.datum.name} (${obj.datum.y.length} datapoints)
          ${formatValue('avg', obj.datum, avg)}, ${formatValue('min', obj.datum, obj.datum._min)}, ${formatValue(
          'max',
          obj.datum,
          obj.datum._max
        )}
          ${formatValue('p25', obj.datum, obj.datum._q1)}, ${formatValue(
          'p50',
          obj.datum,
          obj.datum._median
        )}, ${formatValue('p75', obj.datum, obj.datum._q3)}`;
      }

      return formatValue(obj.datum.name, obj.datum, obj.datum.y, obj.datum.y0);
    },
    labelComponent: labelComponent,
    // We blacklist "parent" as a workaround to avoid the VictoryVoronoiContainer crashing.
    // See https://github.com/FormidableLabs/victory/issues/1355
    voronoiBlacklist: ['parent']
  };
};
