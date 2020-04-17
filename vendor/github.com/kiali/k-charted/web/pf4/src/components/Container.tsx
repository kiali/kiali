import * as React from 'react';
import { format as d3Format } from 'd3-format';
import { getFormatter } from '../../../common/utils/formatter';
import { CustomTooltip } from './CustomTooltip';

import { VictoryVoronoiContainer, createContainer } from 'victory';

type BrushDomain = { x: [number | Date, number | Date], y: [number, number] };

export type BrushHandlers = {
  onCleared?: (domain: BrushDomain, props: any) => void,
  onDomainChange?: (domain: BrushDomain, props: any) => void,
  onDomainChangeEnd?: (domain: BrushDomain, props: any) => void
};

export const newBrushVoronoiContainer = (onClick?: (event: any) => void, handlers?: BrushHandlers) => {
  const voronoiProps = {
    labels: obj => `${obj.datum.name}: ${getFormatter(d3Format, obj.datum.unit)(obj.datum.actualY || obj.datum.y)}`,
    labelComponent: <CustomTooltip onClick={onClick} />,
    // We blacklist "parent" as a workaround to avoid the VictoryVoronoiContainer crashing.
    // See https://github.com/FormidableLabs/victory/issues/1355
    voronoiBlacklist: ['parent']
  };
  if (handlers) {
    const VoronoiBrushContainer = createContainer('brush', 'voronoi');
    return (
      <VoronoiBrushContainer
        brushDimension={'x'}
        brushDomain={{x: [0, 0]}}
        brushStyle={{stroke: 'transparent', fill: 'blue', fillOpacity: 0.1}}
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
