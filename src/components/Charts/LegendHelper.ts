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
            mutation: props => options.onClick!(idx, props)
          },
          {
            childName: [options.itemBaseName + idx],
            target: 'data',
            eventKey: 'all',
            mutation: _ => null
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
            mutation: _ => null
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
