import * as React from 'react';
import { shallow } from 'enzyme';

import { ChartModel } from 'types/Dashboards';
import { VCLines, RichDataPoint } from 'types/VictoryChartInfo';

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
  return {
    Chart: (props: any) => React.createElement('div', null, props.children),
    ChartArea: () => React.createElement('div'),
    ChartAxis: () => null,
    ChartBar: () => React.createElement('div'),
    ChartGroup: (props: any) => React.createElement('div', null, props.children),
    ChartLabel: () => null,
    ChartLine: () => React.createElement('div'),
    ChartProps: {},
    ChartScatter: () => React.createElement('div'),
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
import { KChart } from '../KChart';

const makeChart = (overrides: Partial<ChartModel> = {}): ChartModel => ({
  chartType: 'line',
  metrics: [],
  name: 'Test Chart',
  spans: 6,
  startCollapsed: false,
  unit: 'ops',
  xAxis: 'time',
  ...overrides
});

const makeData = (count = 1): VCLines<RichDataPoint> =>
  Array.from({ length: count }, (_, i) => ({
    color: '#06c',
    datapoints: [{ name: `s${i}`, x: new Date(), y: i + 1, color: '#06c' }],
    legendItem: { name: `s${i}`, symbol: { fill: '#06c', type: 'circle' } }
  }));

describe('KChart', () => {
  it('computes innerChartHeight from refs when mounted', () => {
    const chartHeight = 400;
    const wrapper = shallow(
      <KChart
        chart={makeChart()}
        chartHeight={chartHeight}
        data={makeData()}
        isMaximized={false}
        onToggleMaximized={jest.fn()}
        showSpans={false}
      />
    );

    const instance = wrapper.instance() as any;

    const titleHeight = 24;
    const marginTop = 20;

    instance.titleRef = {
      current: { offsetHeight: titleHeight }
    };
    instance.chartContainerRef = {
      current: {}
    };

    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = jest.fn().mockReturnValue({ marginTop: `${marginTop}px` }) as any;

    instance.measureInnerChartHeight();
    wrapper.update();

    expect((wrapper.state() as any).innerChartHeight).toBe(chartHeight - titleHeight - marginTop);

    window.getComputedStyle = originalGetComputedStyle;
  });

  it('does not update state when measured height is zero or negative', () => {
    const chartHeight = 30;
    const wrapper = shallow(
      <KChart
        chart={makeChart()}
        chartHeight={chartHeight}
        data={makeData()}
        isMaximized={false}
        onToggleMaximized={jest.fn()}
        showSpans={false}
      />
    );

    const instance = wrapper.instance() as any;

    instance.titleRef = { current: { offsetHeight: 20 } };
    instance.chartContainerRef = { current: {} };

    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = jest.fn().mockReturnValue({ marginTop: '20px' }) as any;

    const initialHeight = (wrapper.state() as any).innerChartHeight;
    instance.measureInnerChartHeight();
    wrapper.update();

    expect((wrapper.state() as any).innerChartHeight).toBe(initialHeight);

    window.getComputedStyle = originalGetComputedStyle;
  });

  it('defaults to 300 when chartHeight prop is not provided', () => {
    const wrapper = shallow(
      <KChart
        chart={makeChart()}
        data={makeData()}
        isMaximized={false}
        onToggleMaximized={jest.fn()}
        showSpans={false}
      />
    );

    expect((wrapper.state() as any).innerChartHeight).toBe(300);
  });

  it('collapses when data is empty', () => {
    const wrapper = shallow(
      <KChart chart={makeChart()} data={[]} isMaximized={false} onToggleMaximized={jest.fn()} showSpans={false} />
    );

    expect((wrapper.state() as any).collapsed).toBe(true);
  });
});
