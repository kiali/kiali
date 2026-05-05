import * as React from 'react';
import { act, render } from '@testing-library/react';

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

let capturedChartProps: any;

jest.mock('components/Charts/ChartWithLegend', () => ({
  ChartWithLegend: (props: any) => {
    capturedChartProps = props;
    return null;
  }
}));

jest.mock('../TraceTooltip', () => ({
  TraceTooltip: () => null
}));

// eslint-disable-next-line import/first
import { TracingScatterComponent } from '../TracingScatter';
// eslint-disable-next-line import/first
import { JaegerTrace } from 'types/TracingInfo';

const getChartProps = (): any => capturedChartProps;

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
  // Non-empty so that ChartWithLegend actually renders (the component shows an
  // empty-state when traces is []), which lets the mock capture onTooltipOpen/Close props.
  traces: [makeTrace()],
  ...overrides
});

describe('TracingScatterComponent debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    capturedChartProps = undefined;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not call loadMetricsStats before 400ms have elapsed', () => {
    const props = makeProps();
    render(<TracingScatterComponent {...(props as any)} />);
    const chartProps = getChartProps();

    chartProps.onTooltipOpen({ trace: makeTrace() });
    jest.advanceTimersByTime(399);

    expect(props.loadMetricsStats).not.toHaveBeenCalled();
  });

  it('calls loadMetricsStats after 400ms of sustained hover', () => {
    const props = makeProps();
    render(<TracingScatterComponent {...(props as any)} />);
    const chartProps = getChartProps();

    chartProps.onTooltipOpen({ trace: makeTrace() });
    jest.advanceTimersByTime(400);

    expect(props.loadMetricsStats).toHaveBeenCalledTimes(1);
  });

  it('does not call loadMetricsStats when mouse leaves before 400ms', () => {
    const props = makeProps();
    render(<TracingScatterComponent {...(props as any)} />);
    const chartProps = getChartProps();

    const trace = makeTrace();
    chartProps.onTooltipOpen({ trace });
    jest.advanceTimersByTime(200);
    chartProps.onTooltipClose({ trace });
    jest.advanceTimersByTime(400);

    expect(props.loadMetricsStats).not.toHaveBeenCalled();
  });

  it('does not call loadMetricsStats when component unmounts before 400ms', () => {
    const props = makeProps();
    const { unmount } = render(<TracingScatterComponent {...(props as any)} />);
    const chartProps = getChartProps();

    chartProps.onTooltipOpen({ trace: makeTrace() });
    jest.advanceTimersByTime(200);
    unmount();
    jest.advanceTimersByTime(400);

    expect(props.loadMetricsStats).not.toHaveBeenCalled();
  });

  it('queues the second trace rather than firing a concurrent request when one is already in flight', async () => {
    let resolveFirst!: (value?: void | PromiseLike<void>) => void;
    const firstPromise = new Promise<void>(resolve => {
      resolveFirst = resolve;
    });
    const loadMetricsStats = jest.fn().mockReturnValueOnce(firstPromise).mockResolvedValue(undefined);
    const props = makeProps({ loadMetricsStats });
    render(<TracingScatterComponent {...(props as any)} />);
    const chartProps = getChartProps();

    const trace1 = makeTrace('trace-1');
    const trace2 = makeTrace('trace-2');

    chartProps.onTooltipOpen({ trace: trace1 });
    jest.advanceTimersByTime(400);
    expect(loadMetricsStats).toHaveBeenCalledTimes(1);

    chartProps.onTooltipOpen({ trace: trace2 });
    jest.advanceTimersByTime(400);
    expect(loadMetricsStats).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst();
      await Promise.resolve();
    });

    expect(loadMetricsStats).toHaveBeenCalledTimes(2);
  });
});
