import * as React from 'react';
import { mount, shallow } from 'enzyme';

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
    const wrapper = shallow(
      <ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />
    );

    const legendItems = wrapper.find('[role="button"]');
    expect(legendItems).toHaveLength(3);
    expect(legendItems.at(0).text()).toContain('Series A');
    expect(legendItems.at(1).text()).toContain('Series B');
    expect(legendItems.at(2).text()).toContain('Series C');
  });

  it('toggles series visibility on legend click and restores on second click', () => {
    const data = makeSeries(['Series A', 'Series B']);
    const wrapper = mount(
      <ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />
    );

    const legendItem = (): any => wrapper.find('[role="button"]').at(0);
    legendItem().simulate('click');
    wrapper.update();

    expect((wrapper.state() as any).hiddenSeries.has('Series A')).toBe(true);

    legendItem().simulate('click');
    wrapper.update();

    expect((wrapper.state() as any).hiddenSeries.has('Series A')).toBe(false);
  });

  it('supports keyboard activation with Enter and Space', () => {
    const data = makeSeries(['Series A']);
    const wrapper = mount(
      <ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />
    );

    const legendItem = (): any => wrapper.find('[role="button"]').at(0);

    legendItem().simulate('keydown', { key: 'Enter', preventDefault: jest.fn() });
    wrapper.update();
    expect((wrapper.state() as any).hiddenSeries.has('Series A')).toBe(true);

    legendItem().simulate('keydown', { key: ' ', preventDefault: jest.fn() });
    wrapper.update();
    expect((wrapper.state() as any).hiddenSeries.has('Series A')).toBe(false);
  });

  it('does not render legend when chartHeight is below MIN_HEIGHT_YAXIS', () => {
    const data = makeSeries(['Series A']);
    const wrapper = shallow(
      <ChartWithLegend
        data={data}
        unit="ops"
        seriesComponent={<div />}
        fill={false}
        stroke={true}
        chartHeight={MIN_HEIGHT_YAXIS - 1}
      />
    );

    expect(wrapper.find('[role="button"]')).toHaveLength(0);
  });

  it('reduces SVG chart height by LEGEND_HEIGHT when legend is shown', () => {
    const chartHeight = 300;
    const data = makeSeries(['Series A']);
    const wrapper = shallow(
      <ChartWithLegend
        data={data}
        unit="ops"
        seriesComponent={<div />}
        fill={false}
        stroke={true}
        chartHeight={chartHeight}
      />
    );

    const chart = wrapper.find('Chart');
    expect(chart.prop('height')).toBe(chartHeight - LEGEND_HEIGHT - CHART_LEGEND_GAP);
  });

  it('renderLegendSymbol produces correct SVG elements for each symbol type', () => {
    const types = ['circle', 'diamond', 'star', 'triangleUp', 'triangleDown', undefined];
    const data: VCLines<RichDataPoint> = types.map((type, idx) => ({
      color: '#06c',
      datapoints: [{ name: `s${idx}`, x: new Date(), y: 1, color: '#06c' }],
      legendItem: { name: `s${idx}`, symbol: { fill: '#06c', type } }
    }));

    const wrapper = shallow(
      <ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />
    );

    const svgs = wrapper.find('svg[width="10"]');
    expect(svgs.at(0).find('circle')).toHaveLength(1);
    expect(svgs.at(1).find('polygon')).toHaveLength(1);
    expect(svgs.at(2).find('polygon')).toHaveLength(1);
    expect(svgs.at(3).find('polygon')).toHaveLength(1);
    expect(svgs.at(4).find('polygon')).toHaveLength(1);
    expect(svgs.at(5).find('rect')).toHaveLength(1);
  });

  it('sets aria-pressed on legend items reflecting hidden state', () => {
    const data = makeSeries(['Series A', 'Series B']);
    const wrapper = mount(
      <ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />
    );

    expect(wrapper.find('[role="button"]').at(0).prop('aria-pressed')).toBe(false);

    wrapper.find('[role="button"]').at(0).simulate('click');
    wrapper.update();

    expect(wrapper.find('[role="button"]').at(0).prop('aria-pressed')).toBe(true);
  });

  it('shows toggle button when legendOverflows is true', () => {
    const data = makeSeries(['Series A', 'Series B']);
    const wrapper = shallow(
      <ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />
    );

    expect(wrapper.find('Button')).toHaveLength(0);

    wrapper.setState({ legendOverflows: true });

    expect(wrapper.find('Button')).toHaveLength(1);
  });

  it('does not show toggle button when legend fits in one row', () => {
    const data = makeSeries(['Series A']);
    const wrapper = shallow(
      <ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />
    );

    wrapper.setState({ legendOverflows: false });
    expect(wrapper.find('Button')).toHaveLength(0);
  });

  it('checkLegendOverflow sets legendOverflows state based on DOM measurement', () => {
    const data = makeSeries(['Series A', 'Series B']);
    const wrapper = shallow(
      <ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />
    );

    const instance = wrapper.instance() as any;
    instance.legendRef = { scrollHeight: 50, clientHeight: 25 };
    instance.checkLegendOverflow();

    expect(wrapper.state('legendOverflows')).toBe(true);

    instance.legendRef = { scrollHeight: 25, clientHeight: 25 };
    instance.checkLegendOverflow();

    expect(wrapper.state('legendOverflows')).toBe(false);
  });

  it('toggles legendExpanded state when toggle button is clicked', () => {
    const data = makeSeries(['Series A', 'Series B']);
    const wrapper = shallow(
      <ChartWithLegend data={data} unit="ops" seriesComponent={<div />} fill={false} stroke={true} />
    );

    wrapper.setState({ legendOverflows: true });

    expect(wrapper.state('legendExpanded')).toBe(false);

    wrapper.find('Button').simulate('click');

    expect(wrapper.state('legendExpanded')).toBe(true);

    wrapper.find('Button').simulate('click');

    expect(wrapper.state('legendExpanded')).toBe(false);
  });
});
