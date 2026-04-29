import * as React from 'react';
import { Button, EmptyState, EmptyStateBody, ButtonVariant, EmptyStateVariant } from '@patternfly/react-core';
import { ChartArea, ChartBar, ChartScatter, ChartLine } from '@patternfly/react-charts/victory';
import { CubesIcon, ErrorCircleOIcon } from '@patternfly/react-icons';

import { ChartModel } from 'types/Dashboards';
import { VCLines, RawOrBucket, RichDataPoint, LineInfo } from 'types/VictoryChartInfo';
import { Overlay } from 'types/Overlay';
import { ChartWithLegend, LEGEND_HEIGHT, MIN_HEIGHT, MIN_HEIGHT_YAXIS } from './ChartWithLegend';
import { BrushHandlers } from './Container';
import { KialiIcon } from '../../config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';

type KChartProps<T extends LineInfo> = {
  brushHandlers?: BrushHandlers;
  chart: ChartModel;
  chartHeight?: number;
  data: VCLines<RichDataPoint>;
  isMaximized: boolean;
  onClick?: (datum: RawOrBucket<T>) => void;
  onToggleMaximized: () => void;
  overlay?: Overlay<T>;
  showSpans: boolean;
  showTrendline?: boolean;
  timeWindow?: [Date, Date];
};

export const maximizeButtonStyle: React.CSSProperties = {
  position: 'relative',
  float: 'right'
};

const emptyStyle = kialiStyle({
  padding: '0',
  margin: '0'
});

const kchartStyle = kialiStyle({
  marginLeft: '1.5rem',
  marginRight: '1.5rem'
});

const chartContainerStyle = kialiStyle({
  marginTop: '1.5rem'
});

type State = {
  collapsed: boolean;
  innerChartHeight: number;
};

type ChartTypeData = {
  fill: boolean;
  groupOffset: number;
  seriesComponent: React.ReactElement;
  sizeRatio: number;
  stroke: boolean;
};

const lineInfo: ChartTypeData = {
  fill: false,
  stroke: true,
  groupOffset: 0,
  seriesComponent: <ChartLine />,
  sizeRatio: 1.0
};
const areaInfo: ChartTypeData = {
  fill: true,
  stroke: false,
  groupOffset: 0,
  seriesComponent: <ChartArea />,
  sizeRatio: 1.0
};
const barInfo: ChartTypeData = {
  fill: true,
  stroke: false,
  groupOffset: 7,
  seriesComponent: <ChartBar />,
  sizeRatio: 1 / 6
};
const scatterInfo: ChartTypeData = {
  fill: true,
  stroke: false,
  groupOffset: 0,
  seriesComponent: <ChartScatter />,
  sizeRatio: 1 / 30
};

export class KChart<T extends LineInfo> extends React.Component<KChartProps<T>, State> {
  chartContainerRef: React.RefObject<HTMLDivElement>;
  titleRef: React.RefObject<HTMLDivElement>;

  constructor(props: KChartProps<T>) {
    super(props);
    this.chartContainerRef = React.createRef<HTMLDivElement>();
    this.titleRef = React.createRef<HTMLDivElement>();
    this.state = {
      collapsed: this.props.chart.startCollapsed || (!this.props.chart.error && this.isEmpty()),
      innerChartHeight: this.props.chartHeight || 300
    };
  }

  componentDidMount(): void {
    this.measureInnerChartHeight();
  }

  componentDidUpdate(prevProps: KChartProps<T>): void {
    const propsIsEmpty = !this.props.data.some(s => s.datapoints.length !== 0);
    const prevPropsIsEmpty = !prevProps.data.some(s => s.datapoints.length !== 0);
    if (propsIsEmpty !== prevPropsIsEmpty) {
      this.setState({
        collapsed: propsIsEmpty
      });
    }
    this.measureInnerChartHeight();
  }

  private measureInnerChartHeight = (): void => {
    if (this.titleRef.current && this.chartContainerRef.current) {
      const chartHeight = this.props.chartHeight || 300;
      const titleHeight = this.titleRef.current.offsetHeight;
      const margin = parseFloat(getComputedStyle(this.chartContainerRef.current).marginTop);
      const measured = chartHeight - titleHeight - margin;
      if (measured > 0 && measured !== this.state.innerChartHeight) {
        this.setState({ innerChartHeight: measured });
      }
    }
  };

  render(): React.ReactNode {
    return (
      <div className={kchartStyle}>
        <div
          ref={this.titleRef}
          style={{
            display: 'flex',
            justifyContent: 'space-between'
          }}
        >
          <div
            style={{
              minWidth: '0px',
              display: 'inline-block',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {this.props.chart.name}
          </div>
          {this.props.onToggleMaximized && (
            <div style={maximizeButtonStyle}>
              <Button variant={ButtonVariant.link} onClick={this.props.onToggleMaximized} isInline>
                <KialiIcon.Expand />
              </Button>
            </div>
          )}
        </div>
        <div ref={this.chartContainerRef} className={chartContainerStyle} data-test={'metrics-chart'}>
          {this.props.chart.error ? this.renderError() : this.isEmpty() ? this.renderEmpty() : this.renderChart()}
        </div>
      </div>
    );
  }

  private determineChartType(): ChartTypeData {
    if (this.props.chart.chartType === undefined) {
      if (this.props.chart.xAxis === 'series') {
        return barInfo;
      } else if (this.props.data.some(m => m.datapoints.some(dp => dp.y0))) {
        return areaInfo;
      } else {
        return lineInfo;
      }
    }
    const chartType = this.props.chart.chartType;
    switch (chartType) {
      case 'area':
        return areaInfo;
      case 'bar':
        return barInfo;
      case 'scatter':
        return scatterInfo;
      case 'line':
      default:
        return lineInfo;
    }
  }

  private renderChart(): React.ReactNode {
    if (this.state.collapsed) {
      return undefined;
    }
    const typeData = this.determineChartType();
    const minDomain = this.props.chart.min === undefined ? undefined : { y: this.props.chart.min };
    const maxDomain = this.props.chart.max === undefined ? undefined : { y: this.props.chart.max };
    return (
      <ChartWithLegend
        chartHeight={this.state.innerChartHeight}
        data={this.props.data}
        seriesComponent={typeData.seriesComponent}
        fill={typeData.fill}
        stroke={typeData.stroke}
        showSpans={this.props.showSpans}
        showTrendline={this.props.showTrendline}
        groupOffset={typeData.groupOffset}
        sizeRatio={typeData.sizeRatio}
        overlay={this.props.overlay}
        unit={this.props.chart.unit}
        isMaximized={this.props.isMaximized}
        moreChartProps={{ minDomain: minDomain, maxDomain: maxDomain }}
        onClick={this.props.onClick}
        brushHandlers={this.props.brushHandlers}
        timeWindow={this.props.timeWindow}
        xAxis={this.props.chart.xAxis}
      />
    );
  }

  private isEmpty(): boolean {
    return !this.props.data.some(s => s.datapoints.length !== 0);
  }

  private renderEmpty(): React.ReactNode {
    const chartHeight = this.state.innerChartHeight;
    const conditionalIcon = this.props.isMaximized ? { icon: CubesIcon } : {};

    return chartHeight > MIN_HEIGHT ? (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          height: chartHeight > MIN_HEIGHT_YAXIS ? chartHeight - LEGEND_HEIGHT : chartHeight,
          textAlign: 'center',
          borderLeft: `2px solid ${PFColors.ColorLight200}`,
          borderBottom: `2px solid ${PFColors.ColorLight200}`
        }}
      >
        <EmptyState variant={EmptyStateVariant.sm} className={emptyStyle} {...conditionalIcon}>
          <EmptyStateBody className={emptyStyle}>No data available</EmptyStateBody>
        </EmptyState>
      </div>
    ) : undefined;
  }

  private renderError(): React.ReactNode {
    const conditionalIcon = this.props.isMaximized
      ? { icon: () => <ErrorCircleOIcon style={{ color: PFColors.Danger }} width={32} height={32} /> }
      : {};
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          height: this.state.innerChartHeight,
          textAlign: 'center'
        }}
      >
        <EmptyState variant={EmptyStateVariant.sm} className={emptyStyle} {...conditionalIcon}>
          <EmptyStateBody className={emptyStyle}>
            An error occured while fetching this metric:
            <p>
              <i>{this.props.chart.error}</i>
            </p>
          </EmptyStateBody>
        </EmptyState>
      </div>
    );
  }
}
