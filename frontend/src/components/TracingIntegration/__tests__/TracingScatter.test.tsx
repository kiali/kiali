import * as React from 'react';
import { shallow } from 'enzyme';

jest.mock('@patternfly/react-charts/victory', () => ({
  ChartScatter: () => null
}));

jest.mock('store/Store', () => ({}));

jest.mock('store/Selectors', () => ({
  durationSelector: () => 600
}));

jest.mock('actions/MetricsStatsThunkActions', () => ({
  MetricsStatsThunkActions: { load: jest.fn() }
}));

jest.mock('actions/TracingThunkActions', () => ({
  TracingThunkActions: { setTraceId: jest.fn() }
}));

jest.mock('app/History', () => ({
  HistoryManager: { getParam: () => undefined },
  URLParam: { TRACING_TRACE_ID: 'traceId' }
}));

jest.mock('utils/tracing/TraceStats', () => ({
  averageSpanDuration: () => undefined,
  buildQueriesFromSpans: () => []
}));

jest.mock('components/Charts/ChartWithLegend', () => ({
  ChartWithLegend: () => null
}));

jest.mock('../TraceTooltip', () => ({
  TraceTooltip: () => null
}));

// eslint-disable-next-line import/first
import { TracingScatterComponent } from '../TracingScatter';
// eslint-disable-next-line import/first
import { JaegerTrace } from 'types/TracingInfo';

const makeTrace = (id = 'abc123'): JaegerTrace =>
  (({
    traceID: id,
    traceName: 'test-trace',
    spans: [],
    duration: 5000000,
    startTime: Date.now() * 1000,
    endTime: Date.now() * 1000 + 5000000,
    services: [],
    processes: {}
  } as unknown) as JaegerTrace);

const makeProps = (
  overrides: object = {}
): {
  duration: number;
  loadMetricsStats: jest.Mock<any>;
  setTraceId: jest.Mock<any>;
  showSpansAverage: boolean;
  traces: JaegerTrace[];
} => ({
  duration: 600,
  loadMetricsStats: jest.fn().mockResolvedValue(undefined),
  setTraceId: jest.fn(),
  showSpansAverage: false,
  traces: [],
  ...overrides
});

describe('TracingScatterComponent debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not call loadMetricsStats before 400ms have elapsed', () => {
    const props = makeProps();
    const wrapper = shallow(<TracingScatterComponent {...(props as any)} />);
    const instance = wrapper.instance() as any;

    instance.onTooltipOpen(makeTrace());
    jest.advanceTimersByTime(399);

    expect(props.loadMetricsStats).not.toHaveBeenCalled();
  });

  it('calls loadMetricsStats after 400ms of sustained hover', () => {
    const props = makeProps();
    const wrapper = shallow(<TracingScatterComponent {...(props as any)} />);
    const instance = wrapper.instance() as any;

    instance.onTooltipOpen(makeTrace());
    jest.advanceTimersByTime(400);

    expect(props.loadMetricsStats).toHaveBeenCalledTimes(1);
  });

  it('does not call loadMetricsStats when mouse leaves before 400ms', () => {
    const props = makeProps();
    const wrapper = shallow(<TracingScatterComponent {...(props as any)} />);
    const instance = wrapper.instance() as any;

    const trace = makeTrace();
    instance.onTooltipOpen(trace);
    jest.advanceTimersByTime(200);
    instance.onTooltipClose(trace);
    jest.advanceTimersByTime(400);

    expect(props.loadMetricsStats).not.toHaveBeenCalled();
  });

  it('does not call loadMetricsStats when component unmounts before 400ms', () => {
    const props = makeProps();
    const wrapper = shallow(<TracingScatterComponent {...(props as any)} />);
    const instance = wrapper.instance() as any;

    instance.onTooltipOpen(makeTrace());
    jest.advanceTimersByTime(200);
    wrapper.unmount();
    jest.advanceTimersByTime(400);

    expect(props.loadMetricsStats).not.toHaveBeenCalled();
  });

  it('queues the second trace rather than firing a concurrent request when one is already in flight', () => {
    const neverResolves = new Promise<void>(() => {});
    const loadMetricsStats = jest.fn().mockReturnValue(neverResolves);
    const props = makeProps({ loadMetricsStats });
    const wrapper = shallow(<TracingScatterComponent {...(props as any)} />);
    const instance = wrapper.instance() as any;

    const trace1 = makeTrace('trace-1');
    const trace2 = makeTrace('trace-2');

    instance.onTooltipOpen(trace1);
    jest.advanceTimersByTime(400);
    expect(loadMetricsStats).toHaveBeenCalledTimes(1);

    instance.onTooltipOpen(trace2);
    jest.advanceTimersByTime(400);
    expect(loadMetricsStats).toHaveBeenCalledTimes(1);
    expect(instance.nextToLoad).toBe(trace2);
  });
});
