interface EventItem {
  legendName: string;
  idx: number;
  serieID: string;
  onClick?: (props: any) => any;
  onMouseOver?: (props: any) => any;
}

export type VCEvent = {
  childName: string[];
  target: string;
  eventKey?: string;
  eventHandlers: EventHandlers;
};

type EventHandlers = {
  onClick?: () => EventMutation[],
  onMouseOver?: () => EventMutation[],
  onMouseOut?: () => EventMutation[]
};

type EventMutation = {
  childName: string[];
  target: string;
  mutation: (props: any) => any;
};

export const addLegendEvent = (events: VCEvent[], item: EventItem): void => {
  const eventHandlers: EventHandlers = {};
  if (item.onClick) {
    eventHandlers.onClick = () => {
      return [
        {
          childName: [item.serieID],
          target: 'data',
          mutation: props => item.onClick!(props)
        },
        {
          childName: [item.serieID],
          target: 'data',
          eventKey: 'all',
          mutation: __ => null
        }
      ];
    };
  }
  if (item.onMouseOver) {
    eventHandlers.onMouseOver = () => {
      return [
        {
          childName: [item.serieID],
          target: 'data',
          eventKey: 'all',
          mutation: props => item.onMouseOver!(props)
        }
      ];
    };
    eventHandlers.onMouseOut = () => {
      return [
        {
          childName: [item.serieID],
          target: 'data',
          eventKey: 'all',
          mutation: __ => null
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
