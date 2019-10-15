import * as React from 'react';
import { VictoryLegend } from 'victory';

export interface LegendItem {
  name: string;
  color: string;
}

export const HEIGHT = 30;
export const TOP_MARGIN = 5;

export const buildRateBarsLegend = (name: string, data: LegendItem[], chartHeight: number, width?: number) => {
  return (
    <VictoryLegend
      name={name}
      data={data.map(d => {
        return {
          name: d.name,
          symbol: { fill: d.color }
        };
      })}
      x={39}
      y={chartHeight + TOP_MARGIN - HEIGHT}
      height={HEIGHT}
      width={width}
      gutter={14}
      symbolSpacer={8}
    />
  );
};

interface EventsOptions {
  items: any[];
  legendName: string;
  itemBaseName: string;
  onClick?: (idx: number, props: any) => any;
  onMouseOver?: (idx: number, props: any) => any;
}

export const events = (options: EventsOptions) => {
  return options.items.map((_, idx) => {
    const eventHandlers: any = {};
    if (options.onClick) {
      eventHandlers.onClick = () => {
        return [
          {
            childName: [options.itemBaseName + idx],
            target: 'data',
            eventKey: 'all',
            mutation: props => options.onClick!(idx, props)
          }
        ];
      };
    }
    if (options.onMouseOver) {
      eventHandlers.onMouseOver = () => {
        return [
          {
            childName: [options.itemBaseName + idx],
            target: 'data',
            eventKey: 'all',
            mutation: props => options.onMouseOver!(idx, props)
          }
        ];
      };
      eventHandlers.onMouseOut = () => {
        return [
          {
            childName: [options.itemBaseName + idx],
            target: 'data',
            eventKey: 'all',
            mutation: () => {
              return null;
            }
          }
        ];
      };
    }
    return {
      childName: [options.legendName],
      target: ['data', 'labels'],
      eventKey: String(idx),
      eventHandlers: eventHandlers
    };
  });
};
