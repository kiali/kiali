import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VCLines, RichDataPoint } from 'types/VictoryChartInfo';

// Mock heavy ESM dependencies that Jest cannot transform
jest.mock('d3-format', () => ({
  format: () => (v: number) => String(v)
}));

jest.mock('utils/Formatter', () => ({
  getFormatter: () => (v: number) => String(v),
  getUnit: () => ''
}));

jest.mock('utils/VictoryChartsUtils', () => ({
  toBuckets: jest.fn()
}));

jest.mock('@patternfly/react-charts/victory', () => {
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const MockChart = (props: any) => React.createElement('div', { 'data-test': 'chart', ...props }, props.children);
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
    ChartTooltipProps: {},
    createContainer: () => () => null
  };
});

jest.mock('victory-core', () => ({
  VictoryPortal: (props: any) => props.children
}));

jest.mock('victory-box-plot', () => ({
  VictoryBoxPlot: () => null
}));

jest.mock('victory-voronoi-container', () => {
  const React = require('react');
  return {
    VictoryVoronoiContainer: (props: any) => React.createElement('div', null, props.children)
  };
});

jest.mock('../Container', () => ({
  getVoronoiContainerProps: () => ({})
}));

jest.mock('../CustomTooltip', () => {
  const React = require('react');
  return {
    CustomTooltip: () => React.createElement('div')
  };
});

jest.mock('regression', () => ({
  __esModule: true,
  default: { linear: () => ({ predict: () => [0, 0] }) }
}));

// eslint-disable-next-line import/first -- must import after jest.mock calls
import { ChartWithLegend, CHART_LEGEND_GAP, LEGEND_HEIGHT, MIN_HEIGHT_YAXIS } from '../ChartWithLegend';

const makeSeries = (names: string[]): VCLines<RichDataPoint> =>
  names.map((name, idx) => ({
    color: ['#06c', '#c00', '#0a0', '#f80'][idx % 4],
    datapoints: [{ name, x: new Date('2025-01-01T00:00:00Z'), y: idx + 1, color: '#06c' }],
    legendItem: {
      name,
      symbol: { fill: ['#06c', '#c00', '#0a0', '#f80'][idx % 4], type: 'circle' }
    }
  }));

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
    fireEvent.keyDown(seriesA, { key: 'Enter', preventDefault: jest.fn() });
    expect(seriesA).toHaveAttribute('aria-pressed', 'true');

    fireEvent.keyDown(seriesA, { key: ' ', preventDefault: jest.fn() });
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

  it('shows toggle button when legendOverflows is true', () => {
    const data = makeSeries(['Series A', 'Series B']);
    const { rerender } = render(
      <ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />
    );
    const legendHost = screen.getByRole('button', { name: /Series A/ }).parentElement!;
    Object.defineProperty(legendHost, 'scrollHeight', { configurable: true, value: 50 });
    Object.defineProperty(legendHost, 'clientHeight', { configurable: true, value: 25 });
    rerender(<ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />);

    const toggleButton = screen.getAllByRole('button').find(b => !(b.textContent || '').includes('Series'));
    expect(toggleButton).toBeDefined();
  });

  it('does not show toggle button when legend fits in one row', () => {
    const data = makeSeries(['Series A']);
    render(<ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />);

    const toggleButton = screen.getAllByRole('button').find(b => !(b.textContent || '').includes('Series'));
    expect(toggleButton).toBeUndefined();
  });

  it('checkLegendOverflow sets legendOverflows state based on DOM measurement', () => {
    const data = makeSeries(['Series A', 'Series B']);
    const { rerender } = render(
      <ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />
    );
    const legendHost = screen.getByRole('button', { name: /Series A/ }).parentElement!;
    Object.defineProperty(legendHost, 'scrollHeight', { configurable: true, value: 50 });
    Object.defineProperty(legendHost, 'clientHeight', { configurable: true, value: 25 });
    rerender(<ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />);

    const toggleAfterOverflow = screen.getAllByRole('button').find(b => !(b.textContent || '').includes('Series'));
    expect(toggleAfterOverflow).toBeDefined();

    Object.defineProperty(legendHost, 'scrollHeight', { configurable: true, value: 25 });
    Object.defineProperty(legendHost, 'clientHeight', { configurable: true, value: 25 });
    rerender(<ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />);

    const toggleAfterFit = screen.getAllByRole('button').find(b => !(b.textContent || '').includes('Series'));
    expect(toggleAfterFit).toBeUndefined();
  });

  it('toggles legendExpanded state when toggle button is clicked', async () => {
    const user = userEvent.setup();
    const data = makeSeries(['Series A', 'Series B']);
    const { rerender } = render(
      <ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />
    );
    const legendHost = screen.getByRole('button', { name: /Series A/ }).parentElement!;
    Object.defineProperty(legendHost, 'scrollHeight', { configurable: true, value: 50 });
    Object.defineProperty(legendHost, 'clientHeight', { configurable: true, value: 25 });
    rerender(<ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />);

    const toggleButton = screen.getAllByRole('button').find(b => !(b.textContent || '').includes('Series'));
    expect(toggleButton).toBeDefined();

    const classBefore = legendHost.className;
    await user.click(toggleButton!);
    expect(legendHost.className).not.toBe(classBefore);

    await user.click(toggleButton!);
    expect(legendHost.className).toBe(classBefore);
  });
});
