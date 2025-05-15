import * as React from 'react';
import { Grid, GridItem } from '@patternfly/react-core';
import { ChartThemeColor, getTheme } from '@patternfly/react-charts/victory';

import { AllPromLabelsValues } from 'types/Metrics';
import { ChartModel, DashboardModel } from 'types/Dashboards';
import { getDataSupplier } from 'utils/VictoryChartsUtils';
import { Overlay } from 'types/Overlay';
import { KChart } from './KChart';
import { LineInfo, RawOrBucket } from 'types/VictoryChartInfo';
import { BrushHandlers } from './Container';
import { isArray } from 'lodash';

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
  dashboardHeight: number;
  showSpans: boolean;
  showTrendlines?: boolean;
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

  render() {
    if (this.state.maximizedChart) {
      const chart = this.props.dashboard.charts.find(c => c.name === this.state.maximizedChart);
      if (chart) {
        return this.renderChart(chart);
      }
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

  private getChartHeight = (): number => {
    if (this.state.maximizedChart) {
      return this.props.dashboardHeight;
    }
    // Dashboards define the rows that are used
    // Columns are defined using the spans field in the charts definition using a flex strategy
    // When columns span the grid (12 spans) charts move to the next row
    // By default metrics use a 2 row layout
    const rows = this.props.dashboard.rows > 0 ? this.props.dashboard.rows : 2;
    return this.props.dashboardHeight / rows;
  };

  private renderChart(chart: ChartModel) {
    let colorScale = this.props.colors || getTheme(ChartThemeColor.multi).chart!.colorScale!;
    if (!isArray(colorScale)) {
      colorScale = [colorScale];
    }
    const dataSupplier = getDataSupplier(
      chart,
      { values: this.props.labelValues, prettifier: this.props.labelPrettifier },
      colorScale as string[]
    );
    let onClick: ((datum: RawOrBucket<T>) => void) | undefined = undefined;
    if (this.props.onClick) {
      onClick = (datum: RawOrBucket<T>) => this.props.onClick!(chart, datum);
    }
    return (
      <KChart
        key={chart.name}
        chartHeight={this.getChartHeight()}
        chart={chart}
        showSpans={this.props.showSpans}
        showTrendline={this.props.showTrendlines}
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
