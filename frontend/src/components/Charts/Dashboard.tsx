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
import { kialiStyle } from 'styles/StyleUtils';
import { ResizeHeightObserver } from 'utils/ResizeHeightObserver';

const dashboardContainerStyle = kialiStyle({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  minHeight: 0
});

const chartsGridStyle = kialiStyle({
  rowGap: '1rem'
});

const MIN_CHART_HEIGHT = 150;
const GRID_ROW_GAP = 16;

export type Props<T extends LineInfo> = {
  brushHandlers?: BrushHandlers;
  colors?: string[];
  customMetric?: boolean;
  dashboard: DashboardModel;
  labelPrettifier?: (key: string, value: string) => string;
  labelValues: AllPromLabelsValues;
  maximizedChart?: string;
  onClick?: (chart: ChartModel, datum: RawOrBucket<T>) => void;
  onExpand: (expandedChart?: string) => void;
  overlay?: Overlay<T>;
  showSpans: boolean;
  showTrendlines?: boolean;
  template?: string;
  timeWindow?: [Date, Date];
};

type State = {
  maximizedChart?: string;
  measuredHeight: number;
};

export class Dashboard<T extends LineInfo> extends React.Component<Props<T>, State> {
  private containerRef = React.createRef<HTMLDivElement>();
  private heightObserver: ResizeHeightObserver | null = null;

  constructor(props: Props<T>) {
    super(props);
    this.state = {
      maximizedChart: props.maximizedChart,
      measuredHeight: 0
    };
  }

  componentDidMount(): void {
    this.startObserving();
  }

  componentWillUnmount(): void {
    this.heightObserver?.disconnect();
    this.heightObserver = null;
  }

  private startObserving(): void {
    const el = this.containerRef.current;
    if (!el) {
      return;
    }
    if (!this.heightObserver) {
      this.heightObserver = new ResizeHeightObserver(h => this.setState({ measuredHeight: h }));
    }
    this.heightObserver.observe(el);
  }

  render(): React.ReactNode {
    let content;

    if (this.state.maximizedChart) {
      const chart = this.props.dashboard.charts.find(c => c.name === this.state.maximizedChart);

      if (chart) {
        content = this.renderChart(chart);
      }
    }

    if (!content) {
      content = (
        <Grid className={chartsGridStyle}>
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

    return (
      <div ref={this.containerRef} className={dashboardContainerStyle}>
        {content}
      </div>
    );
  }

  private getChartHeight = (): number => {
    if (this.state.measuredHeight === 0) {
      return MIN_CHART_HEIGHT;
    }

    if (this.state.maximizedChart) {
      return Math.max(this.state.measuredHeight, MIN_CHART_HEIGHT);
    }

    const rows = this.props.dashboard.rows > 0 ? this.props.dashboard.rows : 2;
    const totalGapHeight = (rows - 1) * GRID_ROW_GAP;
    return Math.max(Math.floor((this.state.measuredHeight - totalGapHeight) / rows), MIN_CHART_HEIGHT);
  };

  private renderChart(chart: ChartModel): React.ReactNode {
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
        onToggleMaximized={() => this.handleToggleMaximized(chart.name)}
        isMaximized={this.state.maximizedChart !== undefined}
        overlay={chart.xAxis === 'series' ? undefined : this.props.overlay}
        onClick={onClick}
        brushHandlers={this.props.brushHandlers}
        timeWindow={this.props.timeWindow}
      />
    );
  }

  private handleToggleMaximized = (chartKey: string): void => {
    const maximized = this.state.maximizedChart ? undefined : chartKey;
    this.setState({ maximizedChart: maximized });
    this.props.onExpand(maximized);
  };
}
