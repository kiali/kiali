import * as React from 'react';
import { VictoryVoronoiContainer, createContainer } from 'victory';
import { DomainTuple } from 'victory-core';
import { VictoryVoronoiContainerProps } from 'victory-voronoi-container';
import { VictoryBrushContainerProps } from 'victory-brush-container';
import { format as d3Format } from 'd3-format';
import { getFormatter } from 'utils/Formatter';
import { RichDataPoint } from 'types/VictoryChartInfo';

type BrushDomain = { x: DomainTuple; y: DomainTuple };

export type BrushHandlers = {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  onCleared?: (domain: BrushDomain, props: any) => void;
  onDomainChange?: (domain: BrushDomain, props: any) => void;
  onDomainChangeEnd?: (domain: BrushDomain, props: any) => void;
  /* eslint-enable @typescript-eslint/no-explicit-any */
};

const formatValue = (label: string, datum: RichDataPoint, value: number) => {
  // Formats a value based on unit and scale factor.
  // Scale factor is usually undefined, except when a second axis is in use (then it's the ratio between first axis and second axis maxs)
  return label + ': ' + getFormatter(d3Format, datum.unit!, true)(value / (datum.scaleFactor || 1));
};

export const newBrushVoronoiContainer = (
  labelComponent: JSX.Element,
  handlers: BrushHandlers | undefined,
  hideTooltip: () => boolean
) => {
  const voronoiProps = {
    labels: obj => {
      if (obj.datum.hideLabel || hideTooltip()) {
        return '';
      }
      if (obj.datum._median !== undefined) {
        // Buckets display => datapoint is expected to have _median, _min, _max, _q1, _q3 stats
        const avg = obj.datum.y.reduce((s, y) => s + y, 0) / obj.datum.y.length;
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
      return formatValue(obj.datum.name, obj.datum, obj.datum.y);
    },
    labelComponent: labelComponent,
    // We blacklist "parent" as a workaround to avoid the VictoryVoronoiContainer crashing.
    // See https://github.com/FormidableLabs/victory/issues/1355
    voronoiBlacklist: ['parent']
  };
  if (handlers) {
    const VoronoiBrushContainer = createContainer<VictoryVoronoiContainerProps, VictoryBrushContainerProps>(
      'brush',
      'voronoi'
    );
    return (
      <VoronoiBrushContainer
        brushDimension={'x'}
        brushDomain={{ x: [0, 0] }}
        brushStyle={{ stroke: 'transparent', fill: 'blue', fillOpacity: 0.1 }}
        defaultBrushArea={'none'}
        onBrushCleared={handlers.onCleared}
        onBrushDomainChange={handlers.onDomainChange}
        onBrushDomainChangeEnd={handlers.onDomainChangeEnd}
        {...voronoiProps}
      />
    );
  }
  return <VictoryVoronoiContainer {...voronoiProps} />;
};
