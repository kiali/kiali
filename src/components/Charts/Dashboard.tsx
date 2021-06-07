import * as React from 'react';
import { Grid, GridItem } from '@patternfly/react-core';
import { ChartThemeColor, ChartThemeVariant, getTheme } from '@patternfly/react-charts';

import { AllPromLabelsValues } from 'types/Metrics';
import { ChartModel, DashboardModel, SpanValue } from 'types/Dashboards';
import { getDataSupplier } from 'utils/VictoryChartsUtils';
import { Overlay } from 'types/Overlay';
import KChart from './KChart';
import { LineInfo, RawOrBucket } from 'types/VictoryChartInfo';
import { BrushHandlers } from './Container';

export type Props<T extends LineInfo> = {
  colors?: string[];
  dashboard: DashboardModel;
  maximizedChart?: string;
  expandHandler: (expandedChart?: string) => void;
  labelValues: AllPromLabelsValues;
  labelPrettifier?: (key: string, value: string) => string;
  onClick?: (chart: ChartModel, datum: RawOrBucket<T>) => void;
  brushHandlers?: BrushHandlers;
  template?: string;
  chartHeight: number;
  showSpans: boolean;
  customMetric?: boolean;
  overlay?: Overlay<T>;
  timeWindow?: [Date, Date];
};

type State = {
  maximizedChart?: string;
};

export class Dashboard<T extends LineInfo> extends React.Component<Props<T>, State> {
  constructor(props: Props<T>) {
    super(props);
    this.state = {
      maximizedChart: props.maximizedChart
    };
  }

  renderCharts(charts: ChartModel[], spans?: SpanValue) {
    return (
      <Grid gutter={'md'}>
        {charts.map(c => {
          return (
            <GridItem span={spans || c.spans} key={c.name}>
              {this.renderChart(c)}
            </GridItem>
          );
        })}
      </Grid>
    );
  }

  renderCustom() {
    if (this.props.template && this.props.template === 'envoy') {
      const chartsLength = this.props.dashboard.charts.length;
      var nRows = 2;
      var chartbyRow = ~~(chartsLength / nRows);
      var extraChart = chartsLength % nRows === 0 ? 0 : 1;
      var pos = 0;
      var GridItems: JSX.Element[] = [];

      for (var i = 0; i < nRows; i++) {
        var to = pos + (i === 0 && extraChart ? chartbyRow + 1 : chartbyRow);
        GridItems.push(
          <GridItem span={12}>
            {this.renderCharts(this.props.dashboard.charts.slice(pos, to), ~~(12 / (to - pos)) as SpanValue)}
          </GridItem>
        );
        pos = to;
      }
      return <Grid>{GridItems}</Grid>;
    }

    return (
      <Grid>
        {this.props.dashboard.charts.map(c => {
          return (
            <GridItem span={c.spans} key={c.name}>
              {this.renderChart(c)}
            </GridItem>
          );
        })}
      </Grid>
    );
  }

  render() {
    if (this.state.maximizedChart) {
      const chart = this.props.dashboard.charts.find(c => c.name === this.state.maximizedChart);
      if (chart) {
        return this.renderChart(chart);
      }
    }
    const requestCharts = this.props.dashboard.charts.filter(c => c.name.includes('Request'));
    const responseCharts = this.props.dashboard.charts.filter(c => c.name.includes('Response'));
    const tcpCharts = this.props.dashboard.charts.filter(c => c.name.includes('TCP'));

    return this.props.customMetric ? (
      this.renderCustom()
    ) : (
      <Grid>
        <GridItem span={12}>{this.renderCharts(requestCharts, ~~(12 / requestCharts.length) as SpanValue)}</GridItem>
        <GridItem span={6}>{this.renderCharts(responseCharts, ~~(12 / responseCharts.length) as SpanValue)}</GridItem>
        <GridItem span={6}>{this.renderCharts(tcpCharts, ~~(12 / tcpCharts.length) as SpanValue)}</GridItem>
      </Grid>
    );
  }

  private getHeight = (): number => {
    var gridheight = this.props.chartHeight;
    var title = 30;
    if (this.state.maximizedChart) {
      return gridheight - title - 30;
    }
    if (this.props.template && this.props.template === 'envoy') {
      return (gridheight - title * 3) / 2;
    }
    return (gridheight - title * 2) / 2;
  };

  private renderChart(chart: ChartModel) {
    const colors = this.props.colors || getTheme(ChartThemeColor.multi, ChartThemeVariant.default).chart.colorScale;
    const dataSupplier = getDataSupplier(
      chart,
      { values: this.props.labelValues, prettifier: this.props.labelPrettifier },
      colors
    );
    let onClick: ((datum: RawOrBucket<T>) => void) | undefined = undefined;
    if (this.props.onClick) {
      onClick = (datum: RawOrBucket<T>) => this.props.onClick!(chart, datum);
    }
    return (
      <KChart
        key={chart.name}
        chartHeight={this.getHeight()}
        chart={chart}
        showSpans={this.props.showSpans}
        data={dataSupplier()}
        onToggleMaximized={() => this.onToggleMaximized(chart.name)}
        isMaximized={this.state.maximizedChart !== undefined}
        overlay={chart.xAxis === 'series' ? undefined : this.props.overlay}
        onClick={onClick}
        brushHandlers={this.props.brushHandlers}
        timeWindow={this.props.timeWindow}
      />
    );
  }

  private onToggleMaximized = (chartKey: string): void => {
    const maximized = this.state.maximizedChart ? undefined : chartKey;
    this.setState({ maximizedChart: maximized });
    this.props.expandHandler(maximized);
  };
}
