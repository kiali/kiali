import { addLegendEvent, VCEvent } from '../VictoryEvents';

describe('addLegendEvent', () => {
  it('should produce two events per item (data and labels targets)', () => {
    const events: VCEvent[] = [];
    addLegendEvent(events, {
      idx: 0,
      legendName: 'my-legend',
      serieID: ['serie-0'],
      onClick: () => {}
    });

    expect(events).toHaveLength(2);
    expect(events[0].target).toBe('data');
    expect(events[1].target).toBe('labels');
  });

  it('should set childName and eventKey from the item', () => {
    const events: VCEvent[] = [];
    addLegendEvent(events, {
      idx: 3,
      legendName: 'test-legend',
      serieID: ['serie-3'],
      onClick: () => {}
    });

    for (const event of events) {
      expect(event.childName).toEqual(['test-legend']);
      expect(event.eventKey).toBe('3');
    }
  });

  it('should invoke onClick callback exactly once per click on both data and labels targets', () => {
    const clickSpy = jest.fn();
    const events: VCEvent[] = [];
    addLegendEvent(events, {
      idx: 0,
      legendName: 'legend',
      serieID: ['serie-0'],
      onClick: clickSpy
    });

    const fakeMouseEvent = {} as MouseEvent;
    const fakeProps = {} as any;

    // Verify data target (events[0])
    const dataMutations = events[0].eventHandlers.onClick!(fakeMouseEvent);
    expect(dataMutations).toHaveLength(1);
    dataMutations[0].mutation(fakeProps);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledWith(fakeProps);

    clickSpy.mockClear();

    // Verify labels target (events[1]) behaves identically
    const labelsMutations = events[1].eventHandlers.onClick!(fakeMouseEvent);
    expect(labelsMutations).toHaveLength(1);
    labelsMutations[0].mutation(fakeProps);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledWith(fakeProps);
  });

  it('should not set childName on click mutations', () => {
    const events: VCEvent[] = [];
    addLegendEvent(events, {
      idx: 0,
      legendName: 'legend',
      serieID: ['serie-0'],
      onClick: () => {}
    });

    const mutations = events[0].eventHandlers.onClick!({} as MouseEvent);
    expect(mutations[0].childName).toBeUndefined();
  });

  it('should return null from click mutation', () => {
    const events: VCEvent[] = [];
    addLegendEvent(events, {
      idx: 0,
      legendName: 'legend',
      serieID: ['serie-0'],
      onClick: () => {}
    });

    const mutations = events[0].eventHandlers.onClick!({} as MouseEvent);
    expect(mutations[0].mutation({} as any)).toBeNull();
  });

  it('should register onMouseOver and onMouseOut when provided', () => {
    const overSpy = jest.fn().mockReturnValue({ style: { fill: 'red' } });
    const outSpy = jest.fn().mockReturnValue(null);
    const events: VCEvent[] = [];

    addLegendEvent(events, {
      idx: 1,
      legendName: 'legend',
      serieID: ['serie-1', 'serie-reg-1'],
      onMouseOut: outSpy,
      onMouseOver: overSpy
    });

    expect(events).toHaveLength(2);

    for (const event of events) {
      expect(event.eventHandlers.onMouseOver).toBeDefined();
      expect(event.eventHandlers.onMouseOut).toBeDefined();
    }

    const overMutations = events[0].eventHandlers.onMouseOver!({} as MouseEvent);
    expect(overMutations).toHaveLength(1);
    expect(overMutations[0].childName).toEqual(['serie-1', 'serie-reg-1']);
    expect(overMutations[0].eventKey).toBe('all');
  });

  it('should return null from onMouseOut mutation when onMouseOut callback is not provided', () => {
    const events: VCEvent[] = [];
    addLegendEvent(events, {
      idx: 0,
      legendName: 'legend',
      serieID: ['serie-0'],
      onMouseOver: () => ({ style: { fill: 'red' } })
    });

    const outMutations = events[0].eventHandlers.onMouseOut!({} as MouseEvent);
    expect(outMutations).toHaveLength(1);
    expect(outMutations[0].mutation({} as any)).toBeNull();
  });

  it('should not register click handler when onClick is not provided', () => {
    const events: VCEvent[] = [];
    addLegendEvent(events, {
      idx: 0,
      legendName: 'legend',
      serieID: ['serie-0'],
      onMouseOver: () => ({ style: {} })
    });

    for (const event of events) {
      expect(event.eventHandlers.onClick).toBeUndefined();
    }
  });

  it('should append to existing events array', () => {
    const existing: VCEvent[] = [{ childName: ['prev'], eventHandlers: {}, target: 'data' }];

    addLegendEvent(existing, {
      idx: 0,
      legendName: 'legend',
      serieID: ['serie-0'],
      onClick: () => {}
    });

    expect(existing).toHaveLength(3);
    expect(existing[0].childName).toEqual(['prev']);
  });
});
