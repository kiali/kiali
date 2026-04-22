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

const dashboardContainerStyle = kialiStyle({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  minHeight: 0
});

export type Props<T extends LineInfo> = {
  brushHandlers?: BrushHandlers;
  colors?: string[];
  customMetric?: boolean;
  dashboard: DashboardModel;
  dashboardHeight?: number;
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
  private lastMeasuredHeight = 0;
  private observer: ResizeObserver | null = null;

  constructor(props: Props<T>) {
    super(props);
    this.state = {
      maximizedChart: props.maximizedChart,
      measuredHeight: 0
    };
  }

  componentDidMount(): void {
    if (this.containerRef.current) {
      this.observer = new ResizeObserver(entries => {
        const height = entries[0]?.contentRect.height ?? 0;

        if (Math.abs(this.lastMeasuredHeight - height) >= 2) {
          this.lastMeasuredHeight = height;
          this.setState({ measuredHeight: height });
        }
      });

      this.observer.observe(this.containerRef.current);
    }
  }

  componentWillUnmount(): void {
    this.observer?.disconnect();
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

    return (
      <div ref={this.containerRef} className={dashboardContainerStyle}>
        {content}
      </div>
    );
  }

  private getEffectiveHeight = (): number => {
    return this.props.dashboardHeight ?? this.state.measuredHeight;
  };

  private getChartHeight = (): number => {
    const height = this.getEffectiveHeight();

    if (height <= 0) {
      return 300;
    }

    if (this.state.maximizedChart) {
      return height;
    }

    const rows = this.props.dashboard.rows > 0 ? this.props.dashboard.rows : 2;
    return height / rows;
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
    this.props.onExpand(maximized);
  };
}
