import * as React from 'react';
import { style } from 'typestyle';
import { Grid, GridItem } from '@patternfly/react-core';
import { AngleDoubleLeftIcon } from '@patternfly/react-icons';
import { getTheme, ChartThemeColor, ChartThemeVariant } from '@patternfly/react-charts';

import { AllPromLabelsValues } from '../../../common/types/Labels';
import { DashboardModel, ChartModel } from '../../../common/types/Dashboards';
import { getDataSupplier } from '../utils/victoryChartsUtils';
import { Overlay } from '../types/Overlay';
import KChart from './KChart';
import { VCDataPoint } from '../types/VictoryChartInfo';

const expandedChartContainerStyle = style({
  height: 'calc(100vh - 248px)'
});

const expandedChartBackLinkStyle = style({
  marginTop: '5px',
  textAlign: 'right'
});

type Props = {
  colors?: string[];
  dashboard: DashboardModel;
  expandedChart?: string;
  expandHandler: (expandedChart?: string) => void;
  labelValues: AllPromLabelsValues;
  labelPrettifier?: (key: string, value: string) => string;
  onClick?: (chart: ChartModel, datum: VCDataPoint) => void;
  overlay?: Overlay;
  timeWindow?: [Date, Date];
};

type State = {
  expandedChart?: string;
};

export class Dashboard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      expandedChart: props.expandedChart
    };
  }

  render() {
    if (this.state.expandedChart) {
      return (
        <>
          <h3 className={expandedChartBackLinkStyle}>
            <a href="#" onClick={this.unexpandHandler}>
              <AngleDoubleLeftIcon /> View all metrics
            </a>
          </h3>
          {this.renderExpandedChart(this.state.expandedChart)}
        </>
      );
    }
    return this.renderMetrics();
  }

  renderMetrics() {
    return (
      <Grid>{this.props.dashboard.charts.map(c => this.renderChartCard(c))}</Grid>
    );
  }

  private renderExpandedChart(chartKey: string) {
    const chart = this.props.dashboard.charts.find(c => c.name === chartKey);
    if (chart) {
      return <div className={expandedChartContainerStyle}>{this.renderChart(chart)}</div>;
    }
    return undefined;
  }

  private renderChartCard(chart: ChartModel) {
    return (
      <GridItem span={chart.spans} key={chart.name}>
        {this.renderChart(chart, () => this.expandHandler(chart.name))}
      </GridItem>
    );
  }

  private renderChart(chart: ChartModel, expandHandler?: () => void) {
    const colors = this.props.colors || getTheme(ChartThemeColor.multi, ChartThemeVariant.default).chart.colorScale;
    const dataSupplier = getDataSupplier(chart, { values: this.props.labelValues, prettifier: this.props.labelPrettifier }, colors);
    let onClick: ((datum: VCDataPoint) => void) | undefined = undefined;
    if (this.props.onClick) {
      onClick = (datum: VCDataPoint) => this.props.onClick!(chart, datum);
    }
    return (
      <KChart
        key={chart.name}
        chart={chart}
        data={dataSupplier()}
        expandHandler={expandHandler}
        overlay={this.props.overlay}
        onClick={onClick}
        timeWindow={this.props.timeWindow}
      />
    );
  }

  private expandHandler = (chartKey: string): void => {
    this.setState({ expandedChart: chartKey });
    this.props.expandHandler(chartKey);
  }

  private unexpandHandler = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.setState({ expandedChart: undefined });
    this.props.expandHandler();
  }
}
