import { RawOrBucket, LineInfo } from '../types/VictoryChartInfo';

interface EventItem {
  legendName: string;
  idx: number;
  serieID: string[];
  onClick?: (props: RawOrBucket<LineInfo>) => Partial<RawOrBucket<LineInfo>> | null;
  onMouseOver?: (props: RawOrBucket<LineInfo>) => Partial<RawOrBucket<LineInfo>> | null;
  onMouseOut?: (props: RawOrBucket<LineInfo>) => Partial<RawOrBucket<LineInfo>> | null;
}

export type VCEvent = {
  childName?: string[];
  target: string;
  eventKey?: string;
  eventHandlers: EventHandlers;
};

type EventHandlers = {
  onClick?: (event: MouseEvent) => EventMutation[];
  onMouseOver?: (event: MouseEvent) => EventMutation[];
  onMouseOut?: (event: MouseEvent) => EventMutation[];
};

type EventMutation = {
  childName: string[];
  target: string;
  mutation: (props: RawOrBucket<LineInfo>) => Partial<RawOrBucket<LineInfo>> | null;
};

export const addLegendEvent = (events: VCEvent[], item: EventItem): void => {
  const eventHandlers: EventHandlers = {};
  if (item.onClick) {
    eventHandlers.onClick = e => {
      e.stopPropagation();
      return [
        {
          childName: [item.serieID[0]],
          target: 'data',
          mutation: props => item.onClick!(props)
        },
        {
          childName: [item.serieID[0]],
          target: 'data',
          eventKey: 'all',
          mutation: () => null
        }
      ];
    };
  }
  if (item.onMouseOver) {
    eventHandlers.onMouseOver = () => {
      return [
        {
          childName: item.serieID,
          target: 'data',
          eventKey: 'all',
          mutation: props => item.onMouseOver!(props)
        }
      ];
    };
    eventHandlers.onMouseOut = () => {
      return [
        {
          childName: item.serieID,
          target: 'data',
          eventKey: 'all',
          mutation: props => (item.onMouseOut ? item.onMouseOut(props) : null)
        }
      ];
    };
  }
  events.push({
    childName: [item.legendName],
    target: 'data',
    eventKey: String(item.idx),
    eventHandlers: eventHandlers
  });
  events.push({
    childName: [item.legendName],
    target: 'labels',
    eventKey: String(item.idx),
    eventHandlers: eventHandlers
  });
};
