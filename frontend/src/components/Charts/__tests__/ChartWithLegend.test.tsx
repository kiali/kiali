import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { VCLines, RichDataPoint } from 'types/VictoryChartInfo';

// Mock heavy ESM dependencies that Jest cannot transform
rstest.mock('d3-format', () => ({
  format: () => (v: number) => String(v)
}));

rstest.mock('utils/Formatter', () => ({
  getFormatter: () => (v: number) => String(v),
  getUnit: () => ''
}));

rstest.mock('utils/VictoryChartsUtils', () => ({
  toBuckets: rstest.fn()
}));

let lastChartEvents: any[] = [];

rstest.mock('@patternfly/react-charts/victory', () => {
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const MockChart = (props: any) => {
    // Capture events so click-handler tests can invoke them directly
    const { events, ...rest } = props;
    lastChartEvents = events || [];
    return React.createElement('div', { 'data-test': 'chart', ...rest }, props.children);
  };
  MockChart.displayName = 'Chart';
  return {
    Chart: MockChart,
    ChartArea: () => null,
    ChartAxis: () => null,
    ChartGroup: (props: any) => React.createElement('div', null, props.children),
    ChartLabel: () => null,
    ChartLine: () => null,
    ChartProps: {},
    ChartScatter: () => null,
    ChartThreshold: (props: any) =>
      React.createElement('div', { 'data-test': 'chart-threshold', 'data-name': props.data?.[0]?.name }),
    ChartTooltipProps: {},
    createContainer: () => () => null
  };
});

rstest.mock('victory-core', () => ({
  VictoryPortal: (props: any) => props.children
}));

rstest.mock('victory-box-plot', () => ({
  VictoryBoxPlot: () => null
}));

rstest.mock('victory-voronoi-container', () => {
  const React = require('react');
  return {
    VictoryVoronoiContainer: (props: any) => React.createElement('div', null, props.children)
  };
});

rstest.mock('../Container', () => ({
  getVoronoiContainerProps: () => ({})
}));

rstest.mock('../CustomTooltip', () => {
  const React = require('react');
  return {
    CustomTooltip: () => React.createElement('div')
  };
});

rstest.mock('regression', () => ({
  __esModule: true,
  default: { linear: () => ({ predict: () => [0, 0] }) }
}));

import { ChartWithLegend, CHART_LEGEND_GAP, LEGEND_HEIGHT, MIN_HEIGHT_YAXIS } from '../ChartWithLegend';

const COLORS = ['#06c', '#c00', '#0a0', '#f80'];

const makeSeries = (names: string[], pointCount = 5): VCLines<RichDataPoint> =>
  names.map((name, idx) => {
    const color = COLORS[idx % COLORS.length];
    const base = new Date('2025-01-01T00:00:00Z').getTime();
    const step = 60_000; // 1 minute between points
    return {
      color,
      datapoints: Array.from({ length: pointCount }, (_, i) => ({
        name,
        x: new Date(base + i * step),
        y: 10 * (idx + 1) + Math.sin(i) * 5,
        color
      })),
      legendItem: {
        name,
        symbol: { fill: color, type: 'circle' }
      }
    };
  });

describe('ChartWithLegend', () => {
  it('renders legend items for each series', () => {
    const data = makeSeries(['Series A', 'Series B', 'Series C']);
    render(<ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />);

    const legendItems = screen.getAllByRole('button');
    expect(legendItems).toHaveLength(3);
    expect(legendItems[0]).toHaveTextContent('Series A');
    expect(legendItems[1]).toHaveTextContent('Series B');
    expect(legendItems[2]).toHaveTextContent('Series C');
  });

  it('includes thresholds in the legend and renders ChartThreshold', () => {
    const data = makeSeries(['Series A']);
    const thresholds = makeSeries(['Memory limit']);
    render(
      <ChartWithLegend
        data={data}
        thresholds={thresholds}
        unit="bytes"
        seriesComponent={<div />}
        fill={false}
        stroke={true}
      />
    );

    expect(screen.getByRole('button', { name: /Memory limit/ })).toBeInTheDocument();
    expect(screen.getByTestId('chart-threshold')).toBeInTheDocument();
  });

  it('toggles series visibility on legend click and restores on second click', async () => {
    const user = userEvent.setup();
    const data = makeSeries(['Series A', 'Series B']);
    render(<ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />);

    const seriesA = screen.getByRole('button', { name: /Series A/ });
    await user.click(seriesA);
    expect(seriesA).toHaveAttribute('aria-pressed', 'true');

    await user.click(seriesA);
    expect(seriesA).toHaveAttribute('aria-pressed', 'false');
  });

  it('supports keyboard activation with Enter and Space', () => {
    const data = makeSeries(['Series A']);
    render(<ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />);

    const seriesA = screen.getByRole('button', { name: /Series A/ });
    fireEvent.keyDown(seriesA, { key: 'Enter', preventDefault: rstest.fn() });
    expect(seriesA).toHaveAttribute('aria-pressed', 'true');

    fireEvent.keyDown(seriesA, { key: ' ', preventDefault: rstest.fn() });
    expect(seriesA).toHaveAttribute('aria-pressed', 'false');
  });

  it('does not render legend when chartHeight is below MIN_HEIGHT_YAXIS', () => {
    const data = makeSeries(['Series A']);
    const { container } = render(
      <ChartWithLegend
        data={data}
        unit="ops"
        seriesComponent={<div />}
        fill={false}
        stroke={true}
        chartHeight={MIN_HEIGHT_YAXIS - 1}
      />
    );

    expect(container.querySelector('[role="button"]')).toBeNull();
  });

  it('reduces SVG chart height by LEGEND_HEIGHT when legend is shown', () => {
    const chartHeight = 300;
    const data = makeSeries(['Series A']);
    render(
      <ChartWithLegend
        data={data}
        unit="ops"
        seriesComponent={<div />}
        fill={false}
        stroke={true}
        chartHeight={chartHeight}
      />
    );

    const chart = screen.getByTestId('chart');
    expect(chart).toHaveAttribute('height', String(chartHeight - LEGEND_HEIGHT - CHART_LEGEND_GAP));
  });

  it('renderLegendSymbol produces correct SVG elements for each symbol type', () => {
    const types = ['circle', 'diamond', 'star', 'triangleUp', 'triangleDown', undefined];
    const data: VCLines<RichDataPoint> = types.map((type, idx) => ({
      color: '#06c',
      datapoints: [{ name: `s${idx}`, x: new Date(), y: 1, color: '#06c' }],
      legendItem: { name: `s${idx}`, symbol: { fill: '#06c', type } }
    }));

    const { container } = render(
      <ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />
    );

    const svgs = container.querySelectorAll('svg[width="10"]');
    expect(svgs).toHaveLength(6);
    expect(svgs[0].querySelectorAll('circle')).toHaveLength(1);
    expect(svgs[1].querySelectorAll('polygon')).toHaveLength(1);
    expect(svgs[2].querySelectorAll('polygon')).toHaveLength(1);
    expect(svgs[3].querySelectorAll('polygon')).toHaveLength(1);
    expect(svgs[4].querySelectorAll('polygon')).toHaveLength(1);
    expect(svgs[5].querySelectorAll('rect')).toHaveLength(1);
  });

  it('sets aria-pressed on legend items reflecting hidden state', async () => {
    const user = userEvent.setup();
    const data = makeSeries(['Series A', 'Series B']);
    render(<ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />);

    const seriesA = screen.getByRole('button', { name: /Series A/ });
    expect(seriesA).toHaveAttribute('aria-pressed', 'false');

    await user.click(seriesA);
    expect(seriesA).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not show a legend collapse toggle (legend stays expanded)', () => {
    const data = makeSeries(['Series A', 'Series B', 'Series C', 'Series D']);
    render(<ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />);

    const legendButtons = screen.getAllByRole('button').filter(b => (b.textContent || '').includes('Series'));
    expect(legendButtons).toHaveLength(4);
    const nonSeriesButtons = screen.getAllByRole('button').filter(b => !(b.textContent || '').includes('Series'));
    expect(nonSeriesButtons).toHaveLength(0);
  });

  it('calls onClick when data click handler receives a valid datum', () => {
    const data = makeSeries(['Series A']);
    const onClickSpy = rstest.fn();
    render(
      <ChartWithLegend
        data={data}
        unit="ops"
        seriesComponent={<div />}
        fill={false}
        stroke={true}
        onClick={onClickSpy}
      />
    );

    expect(lastChartEvents).toHaveLength(1);

    const handler = lastChartEvents[0].eventHandlers.onClick;
    const datum = data[0].datapoints[0];
    handler({}, { datum });

    expect(onClickSpy).toHaveBeenCalledTimes(1);
    expect(onClickSpy).toHaveBeenCalledWith(datum);
  });

  it('does not call onClick when data click handler receives undefined datum', () => {
    const data = makeSeries(['Series A']);
    const onClickSpy = rstest.fn();
    render(
      <ChartWithLegend
        data={data}
        unit="ops"
        seriesComponent={<div />}
        fill={false}
        stroke={true}
        onClick={onClickSpy}
      />
    );

    const handler = lastChartEvents[0].eventHandlers.onClick;
    handler({}, { datum: undefined });

    expect(onClickSpy).not.toHaveBeenCalled();
  });

  it('does not register click events when onClick prop is not provided', () => {
    const data = makeSeries(['Series A']);
    render(<ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />);

    expect(lastChartEvents).toHaveLength(0);
  });
});
