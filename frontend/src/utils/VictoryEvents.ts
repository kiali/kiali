import { RawOrBucket, LineInfo } from '../types/VictoryChartInfo';

interface EventItem {
  idx: number;
  legendName: string;
  onClick?: (props: RawOrBucket<LineInfo>) => void;
  onMouseOut?: (props: RawOrBucket<LineInfo>) => Partial<RawOrBucket<LineInfo>> | null;
  onMouseOver?: (props: RawOrBucket<LineInfo>) => Partial<RawOrBucket<LineInfo>> | null;
  serieID: string[];
}

export type VCEvent = {
  childName?: string[];
  eventHandlers: EventHandlers;
  eventKey?: number | string;
  target: string;
};

type EventHandlers = {
  onClick?: (event: MouseEvent) => EventMutation[];
  onMouseOut?: (event: MouseEvent) => EventMutation[];
  onMouseOver?: (event: MouseEvent) => EventMutation[];
};

type EventMutation = {
  childName?: string[];
  eventKey?: string;
  mutation: (props: RawOrBucket<LineInfo>) => Partial<RawOrBucket<LineInfo>> | null;
  target: string;
};

export const addLegendEvent = (events: VCEvent[], item: EventItem): void => {
  // Generate separate events for 'data' (symbol) and 'labels' (text) targets,
  // matching the pattern from PF's getInteractiveLegendEvents utility.
  const targets: string[] = ['data', 'labels'];
  for (const target of targets) {
    const eventHandlers: EventHandlers = {};
    if (item.onClick) {
      // Follow the PF interactive-legend pattern: return a single mutation
      // without childName so it targets the legend item itself, not a sibling
      // data series. This avoids Victory accumulating cross-component mutation
      // state that breaks subsequent clicks.
      eventHandlers.onClick = () => [
        {
          target: 'data',
          mutation: (props: RawOrBucket<LineInfo>) => {
            item.onClick!(props);
            return null;
          }
        }
      ];
    }
    if (item.onMouseOver) {
      eventHandlers.onMouseOver = () => {
        return [
          {
            childName: item.serieID,
            target: 'data',
            eventKey: 'all',
            mutation: (props: RawOrBucket<LineInfo>) => item.onMouseOver!(props)
          }
        ];
      };
      eventHandlers.onMouseOut = () => {
        return [
          {
            childName: item.serieID,
            target: 'data',
            eventKey: 'all',
            mutation: (props: RawOrBucket<LineInfo>) => (item.onMouseOut ? item.onMouseOut(props) : null)
          }
        ];
      };
    }
    events.push({
      childName: [item.legendName],
      eventKey: String(item.idx),
      eventHandlers,
      target
    });
  }
};
