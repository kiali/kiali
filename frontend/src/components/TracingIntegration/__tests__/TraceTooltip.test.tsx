import * as React from 'react';
import { shallow, ShallowWrapper } from 'enzyme';
import { Spinner } from '@patternfly/react-core';

jest.mock('@patternfly/react-charts/victory', () => ({
  ChartCursorFlyout: () => null
}));

jest.mock('store/Store', () => ({}));

jest.mock('utils/tracing/TraceStats', () => ({
  averageSpanDuration: () => 100000,
  reduceMetricsStats: jest.fn()
}));

jest.mock('../TracingResults/StatsComparison', () => ({
  renderTraceHeatMap: () => require('react').createElement('div', { 'data-testid': 'heatmap' })
}));

jest.mock('components/Charts/CustomTooltip', () => ({
  HookedChartTooltip: () => null
}));

// eslint-disable-next-line import/first
import { TraceLabel } from '../TraceTooltip';
// eslint-disable-next-line import/first
import { JaegerTrace } from 'types/TracingInfo';
// eslint-disable-next-line import/first
import { StatsMatrix } from 'utils/tracing/TraceStats';

const makeTrace = (): JaegerTrace =>
  (({
    traceID: 'abc123',
    traceName: 'test-trace',
    spans: [],
    duration: 5000000,
    startTime: Date.now() * 1000,
    endTime: Date.now() * 1000 + 5000000,
    services: [],
    processes: {}
  } as unknown) as JaegerTrace);

const makeMatrix = (withValues: boolean): StatsMatrix => {
  const matrix: (number | undefined)[][] = [
    [undefined, undefined],
    [undefined, undefined]
  ];
  if (withValues) {
    matrix[0][0] = 1.5;
  }
  return matrix;
};

const renderLabel = (statsMatrix: StatsMatrix, isStatsMatrixComplete: boolean): ShallowWrapper =>
  shallow(
    <TraceLabel
      trace={makeTrace()}
      statsMatrix={statsMatrix}
      isStatsMatrixComplete={isStatsMatrixComplete}
      x={100}
      y={100}
    />
  );

describe('TraceLabel heatmap column rendering', () => {
  it('renders the heatmap when stats are available', () => {
    const wrapper = renderLabel(makeMatrix(true), true);

    expect(wrapper.find('[data-testid="heatmap"]')).toHaveLength(1);
    expect(wrapper.find(Spinner)).toHaveLength(0);
  });

  it('renders a spinner while stats are pending for a trace with Envoy spans', () => {
    const wrapper = renderLabel(makeMatrix(false), false);

    expect(wrapper.find(Spinner)).toHaveLength(1);
    expect(wrapper.find('[data-testid="heatmap"]')).toHaveLength(0);
  });

  it('renders n/a when the trace has no Envoy spans and stats will never arrive', () => {
    const wrapper = renderLabel(makeMatrix(false), true);

    expect(wrapper.text()).toContain('n/a');
    expect(wrapper.find(Spinner)).toHaveLength(0);
    expect(wrapper.find('[data-testid="heatmap"]')).toHaveLength(0);
  });
});
