import { act, render } from '@testing-library/react';
import type { Mock } from '@rstest/core';

rstest.mock('@patternfly/react-charts/victory', () => ({
  ChartScatter: () => null
}));

rstest.mock('store/Store', () => ({}));

rstest.mock('store/Selectors', () => ({
  durationSelector: () => 600
}));

rstest.mock('actions/MetricsStatsThunkActions', () => ({
  MetricsStatsThunkActions: { load: rstest.fn() }
}));

rstest.mock('actions/TracingThunkActions', () => ({
  TracingThunkActions: { setTraceId: rstest.fn() }
}));

rstest.mock('app/History', () => ({
  HistoryManager: { getParam: () => undefined },
  URLParam: { TRACING_TRACE_ID: 'traceId' }
}));

rstest.mock('utils/tracing/TraceStats', () => ({
  averageSpanDuration: () => undefined,
  buildQueriesFromSpans: () => []
}));

let capturedChartProps: any;

rstest.mock('components/Charts/ChartWithLegend', () => ({
  ChartWithLegend: (props: any) => {
    capturedChartProps = props;
    return null;
  }
}));

rstest.mock('../TraceTooltip', () => ({
  TraceTooltip: () => null
}));

import { TracingScatterComponent } from '../TracingScatter';
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
  loadMetricsStats: Mock<any>;
  setTraceId: Mock<any>;
  showSpansAverage: boolean;
  traces: JaegerTrace[];
} => ({
  duration: 600,
  loadMetricsStats: rstest.fn().mockResolvedValue(undefined),
  setTraceId: rstest.fn(),
  showSpansAverage: false,
  // Non-empty so that ChartWithLegend actually renders (the component shows an
  // empty-state when traces is []), which lets the mock capture onTooltipOpen/Close props.
  traces: [makeTrace()],
  ...overrides
});

describe('TracingScatterComponent debounce', () => {
  beforeEach(() => {
    rstest.useFakeTimers();
    capturedChartProps = undefined;
  });

  afterEach(() => {
    rstest.useRealTimers();
  });

  it('does not call loadMetricsStats before 400ms have elapsed', () => {
    const props = makeProps();
    render(<TracingScatterComponent {...(props as any)} />);
    const chartProps = getChartProps();

    chartProps.onTooltipOpen({ trace: makeTrace() });
    rstest.advanceTimersByTime(399);

    expect(props.loadMetricsStats).not.toHaveBeenCalled();
  });

  it('calls loadMetricsStats after 400ms of sustained hover', () => {
    const props = makeProps();
    render(<TracingScatterComponent {...(props as any)} />);
    const chartProps = getChartProps();

    chartProps.onTooltipOpen({ trace: makeTrace() });
    rstest.advanceTimersByTime(400);

    expect(props.loadMetricsStats).toHaveBeenCalledTimes(1);
  });

  it('does not call loadMetricsStats when mouse leaves before 400ms', () => {
    const props = makeProps();
    render(<TracingScatterComponent {...(props as any)} />);
    const chartProps = getChartProps();

    const trace = makeTrace();
    chartProps.onTooltipOpen({ trace });
    rstest.advanceTimersByTime(200);
    chartProps.onTooltipClose({ trace });
    rstest.advanceTimersByTime(400);

    expect(props.loadMetricsStats).not.toHaveBeenCalled();
  });

  it('does not call loadMetricsStats when component unmounts before 400ms', () => {
    const props = makeProps();
    const { unmount } = render(<TracingScatterComponent {...(props as any)} />);
    const chartProps = getChartProps();

    chartProps.onTooltipOpen({ trace: makeTrace() });
    rstest.advanceTimersByTime(200);
    unmount();
    rstest.advanceTimersByTime(400);

    expect(props.loadMetricsStats).not.toHaveBeenCalled();
  });

  it('queues the second trace rather than firing a concurrent request when one is already in flight', async () => {
    let resolveFirst!: (value?: void | PromiseLike<void>) => void;
    const firstPromise = new Promise<void>(resolve => {
      resolveFirst = resolve;
    });
    const loadMetricsStats = rstest.fn().mockReturnValueOnce(firstPromise).mockResolvedValue(undefined);
    const props = makeProps({ loadMetricsStats });
    render(<TracingScatterComponent {...(props as any)} />);
    const chartProps = getChartProps();

    const trace1 = makeTrace('trace-1');
    const trace2 = makeTrace('trace-2');

    chartProps.onTooltipOpen({ trace: trace1 });
    rstest.advanceTimersByTime(400);
    expect(loadMetricsStats).toHaveBeenCalledTimes(1);

    chartProps.onTooltipOpen({ trace: trace2 });
    rstest.advanceTimersByTime(400);
    expect(loadMetricsStats).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst();
      await Promise.resolve();
    });

    expect(loadMetricsStats).toHaveBeenCalledTimes(2);
  });
});
