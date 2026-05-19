import { render, screen } from '@testing-library/react';

import { ChartModel } from 'types/Dashboards';
import { VCLines, RichDataPoint } from 'types/VictoryChartInfo';

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

rstest.mock('@patternfly/react-charts/victory', () => {
  const React = require('react');
  return {
    Chart: (props: any) =>
      React.createElement(
        'div',
        { 'data-test': 'victory-chart-inner', 'data-chart-height': props.height },
        props.children
      ),
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

// eslint-disable-next-line import/first
import { KChart } from '../KChart';
// eslint-disable-next-line import/first
import { CHART_LEGEND_GAP, LEGEND_HEIGHT } from '../ChartWithLegend';

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
  let offsetHeightSpy: ReturnType<typeof rstest.spyOn>;
  let getComputedStyleSpy: ReturnType<typeof rstest.spyOn>;

  afterEach(() => {
    offsetHeightSpy?.mockRestore();
    getComputedStyleSpy?.mockRestore();
  });

  it('computes innerChartHeight from refs when mounted', () => {
    const chartHeight = 400;
    const titleHeight = 24;
    const marginTop = 20;

    offsetHeightSpy = rstest
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockImplementation(function (this: HTMLElement) {
        const el = this as HTMLElement & { style?: CSSStyleDeclaration };
        if (el.style?.display === 'flex' && el.style?.justifyContent === 'space-between') {
          return titleHeight;
        }
        return 0;
      });
    getComputedStyleSpy = rstest.spyOn(window, 'getComputedStyle').mockReturnValue({
      marginTop: `${marginTop}px`
    } as CSSStyleDeclaration);

    render(
      <KChart
        chart={makeChart()}
        chartHeight={chartHeight}
        data={makeData()}
        isMaximized={false}
        onToggleMaximized={rstest.fn()}
        showSpans={false}
      />
    );

    const inner = chartHeight - titleHeight - marginTop;
    const expectedChartSvgHeight = inner - LEGEND_HEIGHT - CHART_LEGEND_GAP;
    expect(screen.getByTestId('victory-chart-inner')).toHaveAttribute(
      'data-chart-height',
      String(expectedChartSvgHeight)
    );
  });

  it('does not update state when measured height is zero or negative', () => {
    const chartHeight = 30;
    offsetHeightSpy = rstest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(20);
    getComputedStyleSpy = rstest.spyOn(window, 'getComputedStyle').mockReturnValue({
      marginTop: '20px'
    } as CSSStyleDeclaration);

    render(
      <KChart
        chart={makeChart()}
        chartHeight={chartHeight}
        data={makeData()}
        isMaximized={false}
        onToggleMaximized={rstest.fn()}
        showSpans={false}
      />
    );

    expect(screen.getByTestId('victory-chart-inner')).toHaveAttribute('data-chart-height', '30');
  });

  it('defaults to 300 when chartHeight prop is not provided', () => {
    offsetHeightSpy = rstest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(0);
    getComputedStyleSpy = rstest.spyOn(window, 'getComputedStyle').mockReturnValue({
      marginTop: '0px'
    } as CSSStyleDeclaration);

    render(
      <KChart
        chart={makeChart()}
        data={makeData()}
        isMaximized={false}
        onToggleMaximized={rstest.fn()}
        showSpans={false}
      />
    );

    const expectedSvg = 300 - LEGEND_HEIGHT - CHART_LEGEND_GAP;
    expect(screen.getByTestId('victory-chart-inner')).toHaveAttribute('data-chart-height', String(expectedSvg));
  });

  it('collapses when data is empty', () => {
    render(
      <KChart chart={makeChart()} data={[]} isMaximized={false} onToggleMaximized={rstest.fn()} showSpans={false} />
    );

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });
});
