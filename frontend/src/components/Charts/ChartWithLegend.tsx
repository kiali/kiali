import * as React from 'react';
import { ChartProps, ChartTooltipProps } from '@patternfly/react-charts/victory';
import {
  ChartAxis,
  Chart,
  ChartGroup,
  ChartScatter,
  ChartLabel,
  ChartLine,
  createContainer
} from '@patternfly/react-charts/victory';
import { VictoryPortal } from 'victory-core';
import { VictoryBoxPlot } from 'victory-box-plot';
import { format as d3Format } from 'd3-format';
import { getFormatter, getUnit } from 'utils/Formatter';
import { VCLines, LegendItem, LineInfo, RichDataPoint, RawOrBucket, VCDataPoint } from 'types/VictoryChartInfo';
import { Overlay } from 'types/Overlay';
import { BrushHandlers, getVoronoiContainerProps } from './Container';
import { toBuckets } from 'utils/VictoryChartsUtils';
import { VCEvent } from 'utils/VictoryEvents';
import { XAxisType } from 'types/Dashboards';
import { CustomTooltip } from './CustomTooltip';
import { INTERPOLATION_STRATEGY } from './SparklineChart';
import { KialiIcon } from '../../config/KialiIcon';
import { Button, ButtonVariant, Tooltip, TooltipPosition } from '@patternfly/react-core';
import regression from 'regression';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { t } from 'utils/I18nUtils';
import { VictoryVoronoiContainer } from 'victory-voronoi-container';

type Props<T extends RichDataPoint, O extends LineInfo> = {
  brushHandlers?: BrushHandlers;
  chartHeight?: number;
  data: VCLines<T & VCDataPoint>;
  fill?: boolean;
  groupOffset?: number;
  isMaximized?: boolean;
  labelComponent?: React.ReactElement<ChartTooltipProps>;
  moreChartProps?: ChartProps;
  onClick?: (datum: RawOrBucket<O>) => void;
  onTooltipClose?: (datum: RawOrBucket<O>) => void;
  onTooltipOpen?: (datum: RawOrBucket<O>) => void;
  overlay?: Overlay<O>;
  overrideSeriesComponentStyle?: boolean;
  // The TracingScatter component needs a flag to indicate that the trace datapoint needs a mouse pointer
  // It could be detected indirectly, but it's complicated and less clear, a new optional flag simplifies this logic
  pointer?: boolean;
  seriesComponent: React.ReactElement;
  showSpans?: boolean;
  showTrendline?: boolean;
  sizeRatio?: number;
  stroke?: boolean;
  timeWindow?: [Date, Date];
  unit: string;
  xAxis?: XAxisType;
};

type State = {
  hiddenSeries: Set<string>;
  legendExpanded: boolean;
  legendOverflows: boolean;
  width: number;
};

type Padding = { bottom: number; left: number; right: number; top: number };

type ScaleInfo = { count: number; format: string };

const overlayName = 'overlay';

const axisStyle = {
  tickLabels: { fontSize: 12, padding: 2 },
  grid: {
    fill: 'none',
    stroke: PFColors.ColorLight300,
    strokeDasharray: '10, 5',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    pointerEvents: 'painted'
  }
};

export const MIN_HEIGHT = 20;
export const MIN_HEIGHT_YAXIS = 70;
export const MIN_WIDTH = 275;
export const LEGEND_HEIGHT = 25;
export const CHART_LEGEND_GAP = 4;
const CHART_BOTTOM_PADDING = 16;

const legendCollapsedStyle = kialiStyle({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0 1rem',
  height: `${LEGEND_HEIGHT}px`,
  overflow: 'hidden'
});

const legendExpandedStyle = kialiStyle({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0 1rem'
});

const htmlLegendItemStyle = kialiStyle({
  alignItems: 'center',
  cursor: 'pointer',
  display: 'inline-flex',
  fontSize: '0.875rem',
  gap: '0.25rem',
  userSelect: 'none'
});

const legendToggleStyle = kialiStyle({
  marginLeft: 'auto'
});

export class ChartWithLegend<T extends RichDataPoint, O extends LineInfo> extends React.Component<Props<T, O>, State> {
  containerRef: React.RefObject<HTMLDivElement>;
  hoveredItem?: VCDataPoint;
  legendRef: HTMLDivElement | null = null;
  private mountTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(props: Props<T, O>) {
    super(props);
    this.containerRef = React.createRef<HTMLDivElement>();
    this.state = {
      hiddenSeries: new Set([overlayName]),
      legendExpanded: false,
      legendOverflows: false,
      width: 0
    };
  }

  componentDidMount(): void {
    this.mountTimer = setTimeout(() => {
      this.mountTimer = undefined;
      this.handleResize();
      this.checkLegendOverflow();
      window.addEventListener('resize', this.handleResize);
    });
  }

  componentDidUpdate(): void {
    this.checkLegendOverflow();
  }

  componentWillUnmount(): void {
    if (this.mountTimer !== undefined) {
      clearTimeout(this.mountTimer);
    }
    window.removeEventListener('resize', this.handleResize);
  }

  private checkLegendOverflow = (): void => {
    if (this.legendRef && !this.state.legendExpanded) {
      const overflows = this.legendRef.scrollHeight > this.legendRef.clientHeight;

      if (overflows !== this.state.legendOverflows) {
        this.setState({ legendOverflows: overflows });
      }
    }
  };

  private onTooltipClose = (): void => {
    if (this.props.onTooltipClose) {
      this.props.onTooltipClose(this.hoveredItem as RawOrBucket<O>);
    }

    this.hoveredItem = undefined;
  };

  private onTooltipOpen = (points?: VCDataPoint[]): void => {
    if (points && points.length > 0) {
      this.hoveredItem = points[0];
    } else {
      this.hoveredItem = undefined;
    }

    if (this.props.onTooltipOpen) {
      this.props.onTooltipOpen(this.hoveredItem as RawOrBucket<O>);
    }
  };

  private handleToggleLegendExpanded = (): void => {
    this.setState(prevState => ({ legendExpanded: !prevState.legendExpanded }));
  };

  render(): React.ReactNode {
    const scaleInfo = this.scaledAxisInfo(this.props.data);
    const fullLegendData = this.buildFullLegendData();
    const chartHeight = this.props.chartHeight ?? 300;
    const showOverlay = (this.props.overlay && this.props.showSpans) ?? false;
    const overlayRightPadding = showOverlay ? 15 : 0;

    const showLegend = chartHeight > MIN_HEIGHT_YAXIS;
    const padding: Padding = {
      bottom: showLegend ? CHART_BOTTOM_PADDING : 0,
      left: 10,
      right: 10 + overlayRightPadding,
      top: 0
    };

    let useSecondAxis = showOverlay;
    let normalizedOverlay: RawOrBucket<O>[] = [];
    let overlayFactor = 1.0;

    const mainMax = Math.max(...this.props.data.map(line => Math.max(...line.datapoints.map(d => d.y))));

    if (this.props.overlay) {
      // Normalization for y-axis display to match y-axis domain of the main data
      // (see https://formidable.com/open-source/victory/gallery/multiple-dependent-axes/)
      const overlayMax = Math.max(...this.props.overlay.vcLine.datapoints.map(d => d.y));

      if (overlayMax !== 0) {
        overlayFactor = mainMax / overlayMax;
      }

      if (this.props.unit === this.props.overlay.info.lineInfo.unit && overlayFactor > 0.5 && overlayFactor < 2) {
        // Looks like it's fine to re-use the existing axis
        useSecondAxis = false;
        overlayFactor = 1.0;
      }

      normalizedOverlay = this.normalizeOverlay(overlayFactor);

      if (this.props.overlay.info.buckets) {
        // Transform to bucketed stats
        const model: O = { ...this.props.overlay.info.lineInfo, scaleFactor: overlayFactor };
        normalizedOverlay = toBuckets(
          this.props.overlay.info.buckets,
          normalizedOverlay as (VCDataPoint & O)[],
          model,
          this.props.timeWindow
        );
      }
    }

    const tooltipHooks = { onOpen: this.onTooltipOpen, onClose: this.onTooltipClose };

    const labelComponent = this.props.labelComponent ? (
      React.cloneElement(this.props.labelComponent as any, tooltipHooks)
    ) : (
      <CustomTooltip showTime={true} {...tooltipHooks} />
    );

    const filteredData = this.props.data.filter(s => !this.state.hiddenSeries.has(s.legendItem.name));

    const events: VCEvent[] = [];

    if (this.props.onClick) {
      // Register click events directly on data series so Victory provides the
      // clicked datum synchronously, avoiding the race where hoveredItem is set
      // asynchronously through the tooltip mount lifecycle.
      const serieNames = filteredData.map((_, idx) => `serie-${idx}`);
      const onClick = this.props.onClick;

      // Victory data-level handlers receive (event, victoryProps) but the VCEvent
      // type only declares (event).  We cast to any to bridge the mismatch.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dataClickHandler: any = (_evt: MouseEvent, victoryProps: { datum: RawOrBucket<O> }) => {
        onClick(victoryProps.datum);
        return [];
      };

      events.push({
        childName: serieNames,
        target: 'data',
        eventHandlers: { onClick: dataClickHandler }
      });
    }

    const voronoiProps = getVoronoiContainerProps(labelComponent, () => false);

    let containerComponent: React.ReactElement;

    if (this.props.brushHandlers) {
      const VoronoiBrushContainer = createContainer('brush', 'voronoi');

      containerComponent = (
        <VoronoiBrushContainer
          brushDimension={'x'}
          brushDomain={{ x: [0, 0] }}
          brushStyle={{ stroke: 'transparent', fill: 'blue', fillOpacity: 0.1 }}
          defaultBrushArea={'none'}
          onBrushCleared={this.props.brushHandlers.onCleared}
          onBrushDomainChange={this.props.brushHandlers.onDomainChange}
          onBrushDomainChangeEnd={this.props.brushHandlers.onDomainChangeEnd}
          {...voronoiProps}
        />
      );
    } else {
      containerComponent = <VictoryVoronoiContainer {...voronoiProps} />;
    }

    const svgHeight = showLegend ? chartHeight - LEGEND_HEIGHT - CHART_LEGEND_GAP : chartHeight;
    const chart = (
      <div ref={this.containerRef} style={{ marginTop: 0 }}>
        <div style={{ lineHeight: 0, marginBottom: CHART_LEGEND_GAP }}>
          <Chart
            width={this.state.width}
            padding={padding}
            events={events as any[]}
            height={svgHeight}
            containerComponent={containerComponent}
            scale={{ x: this.props.xAxis === 'series' ? 'linear' : 'time', y: 'linear' }}
            // Prevents data at min/max from being clipped at the SVG boundary,
            // and keeps points away from edges where they'd be hard to click.
            domainPadding={{ y: 10, x: this.props.xAxis === 'series' ? 50 : 15 }}
            {...this.props.moreChartProps}
          >
            {
              // Use width to change style of the x series supporting narrow scenarios
              this.props.xAxis === 'series' ? (
                <ChartAxis
                  domain={[0, filteredData.length + 1]}
                  style={axisStyle}
                  tickValues={filteredData.map(s => s.legendItem.name)}
                  tickFormat={() => ''}
                />
              ) : this.state.width <= MIN_WIDTH ? (
                <ChartAxis
                  tickCount={scaleInfo.count}
                  style={axisStyle}
                  domain={this.props.timeWindow}
                  tickFormat={t => {
                    return `:${t.getMinutes()}`;
                  }}
                />
              ) : (
                <ChartAxis tickCount={scaleInfo.count} style={axisStyle} domain={this.props.timeWindow} />
              )
            }

            <ChartAxis
              tickLabelComponent={
                <VictoryPortal>
                  <ChartLabel />
                </VictoryPortal>
              }
              dependentAxis={true}
              tickCount={chartHeight <= MIN_HEIGHT_YAXIS ? 1 : undefined}
              tickFormat={getFormatter(d3Format, this.props.unit)}
              label={getUnit(d3Format, this.props.unit, mainMax)}
              axisLabelComponent={<ChartLabel y={-10} x={0} angle={0} renderInPortal={true} />}
              style={axisStyle}
            />

            {useSecondAxis && this.props.overlay && (
              <ChartAxis
                dependentAxis={true}
                offsetX={this.state.width - overlayRightPadding}
                style={axisStyle}
                tickCount={chartHeight <= MIN_HEIGHT_YAXIS ? 1 : undefined}
                tickFormat={t =>
                  getFormatter(d3Format, this.props.overlay?.info.lineInfo.unit ?? '')(t / overlayFactor)
                }
                tickLabelComponent={<ChartLabel dx={15} textAnchor="start" />}
                label={getUnit(
                  d3Format,
                  this.props.overlay?.info.lineInfo.unit ?? '',
                  Math.max(...this.props.overlay.vcLine.datapoints.map(d => d.y))
                )}
                axisLabelComponent={
                  <ChartLabel
                    y={-10}
                    x={this.state.width}
                    angle={0}
                    renderInPortal={true}
                    style={{ fill: PFColors.Color100 }}
                  />
                }
              />
            )}

            {this.props.xAxis === 'series' ? this.renderCategories() : this.renderTimeSeries(svgHeight)}

            {showOverlay &&
              (this.props.overlay!.info.buckets ? (
                <VictoryBoxPlot
                  key="overlay"
                  name={overlayName}
                  data={normalizedOverlay}
                  style={{
                    min: { stroke: this.props.overlay!.info.lineInfo.color, strokeWidth: 2 },
                    max: { stroke: this.props.overlay!.info.lineInfo.color, strokeWidth: 2 },
                    q1: { fill: this.props.overlay!.info.lineInfo.color },
                    q3: { fill: this.props.overlay!.info.lineInfo.color },
                    median: { stroke: 'white', strokeWidth: 2 }
                  }}
                />
              ) : (
                <ChartScatter
                  key="overlay"
                  name={overlayName}
                  data={normalizedOverlay}
                  style={{ data: this.props.overlay!.info.dataStyle }}
                />
              ))}
          </Chart>
        </div>

        {showLegend && (
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div
              ref={ref => {
                this.legendRef = ref;
              }}
              className={this.state.legendExpanded ? legendExpandedStyle : legendCollapsedStyle}
              style={{ flex: 1 }}
            >
              {fullLegendData.map(item => (
                <span
                  key={item.name}
                  aria-pressed={this.state.hiddenSeries.has(item.name)}
                  className={htmlLegendItemStyle}
                  onClick={() => this.handleToggleSeries(item.name)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      this.handleToggleSeries(item.name);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10">
                    {this.renderLegendSymbol(item.symbol)}
                  </svg>
                  <span style={{ color: this.state.hiddenSeries.has(item.name) ? PFColors.Color200 : undefined }}>
                    {item.name}
                  </span>
                </span>
              ))}
            </div>

            {(this.state.legendOverflows || this.state.legendExpanded) && (
              <Tooltip
                position={TooltipPosition.left}
                content={
                  <div style={{ textAlign: 'left' }}>
                    {this.state.legendExpanded ? t('Collapse legend') : t('Show full legend')}
                  </div>
                }
              >
                <Button
                  variant={ButtonVariant.link}
                  className={legendToggleStyle}
                  isInline
                  onClick={this.handleToggleLegendExpanded}
                >
                  <KialiIcon.MoreLegend />
                </Button>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    );

    return chartHeight > MIN_HEIGHT ? (
      chart
    ) : (
      <div>
        <Tooltip
          position={TooltipPosition.right}
          content={<div style={{ textAlign: 'left' }}>{t('Increase height of the chart')}</div>}
        >
          <Button variant={ButtonVariant.link} isInline>
            <KialiIcon.MoreLegend />
          </Button>
        </Tooltip>
      </div>
    );
  }

  private renderTimeSeries = (height: number): React.ReactNode => {
    const groupOffset = this.props.groupOffset ?? 0;

    return (
      <ChartGroup offset={groupOffset} height={height}>
        {this.props.data
          .map((serie, idx) => {
            if (this.state.hiddenSeries.has(serie.legendItem.name)) {
              return undefined;
            }

            const plot = React.cloneElement(
              this.props.seriesComponent,
              this.withStyle(
                {
                  key: `serie-${idx}`,
                  name: `serie-${idx}`,
                  data: serie.datapoints,
                  interpolation: INTERPOLATION_STRATEGY
                },
                serie.color
              )
            );

            // serie.datapoints may contain undefined values in certain scenarios i.e. "unknown" values
            if (this.props.showTrendline === true && serie.datapoints[0]) {
              const first_dpx = (serie.datapoints[0].x as Date).getTime() / 1000;

              const datapoints = serie.datapoints.map(d => {
                let t = ((d.x as Date).getTime() / 1000 - first_dpx) / 10000;
                let trendPoint = parseFloat(d.y.toString());

                if (d.y0) {
                  // If both reporters are enabled, generate the trend line using
                  // the mean values of both reporters
                  trendPoint += parseFloat(d.y0.toString());
                  trendPoint *= 0.5;
                }

                // Array is [time, y];
                return [t, trendPoint];
              });

              const linearRegression = regression.linear(datapoints, { precision: 10 });

              let regressionDatapoints = serie.datapoints.map(d => ({
                ...d,
                name: `${d.name} (trendline)`,
                y: linearRegression.predict(((d.x as Date).getTime() / 1000 - first_dpx) / 10000)[1],
                y0: undefined // Clear y0, in case it is set to prevent the tooltip showing this value.
              }));

              const regressionPlot = React.cloneElement(
                <ChartLine />, // Trend lines are always line charts.
                this.withStyle(
                  {
                    key: `serie-reg-${idx}`,
                    name: `serie-reg-${idx}`,
                    data: regressionDatapoints,
                    interpolation: INTERPOLATION_STRATEGY
                  },
                  serie.color,
                  true
                )
              );

              return [plot, regressionPlot];
            }

            return [plot];
          })
          .flat()}
      </ChartGroup>
    );
  };

  private renderCategories = (): React.ReactNode => {
    let domainX = 1;
    const nbSeries = this.props.data.filter(s => !this.state.hiddenSeries.has(s.legendItem.name)).length;
    const size = ((this.props.sizeRatio ?? 1) * this.state.width) / Math.max(nbSeries, 1);

    return this.props.data.map((serie, idx) => {
      if (this.state.hiddenSeries.has(serie.legendItem.name)) {
        return undefined;
      }

      return React.cloneElement(
        this.props.seriesComponent,
        this.withStyle(
          {
            key: `serie-${idx}`,
            name: `serie-${idx}`,
            data: serie.datapoints.map(d => ({ size: size, ...d, x: domainX++ })),
            barWidth: size
          },
          serie.color
        )
      );
    });
  };

  private withStyle = (
    props: { [key: string]: unknown },
    color?: string,
    strokeDasharray?: boolean
  ): { [key: string]: unknown } => {
    return this.props.overrideSeriesComponentStyle === false
      ? props
      : {
          ...props,
          style: {
            data: {
              fill: this.props.fill ? color : undefined,
              stroke: this.props.stroke ? color : undefined,
              strokeDasharray: strokeDasharray === true ? '3 5' : undefined,
              cursor: this.props.pointer ? 'pointer' : 'default'
            }
          }
        };
  };

  private handleResize = (): void => {
    if (this.containerRef && this.containerRef.current) {
      this.setState({ width: this.containerRef.current.clientWidth });
    }
  };

  private renderLegendSymbol = (symbol: { fill: string; type?: string }): React.ReactNode => {
    switch (symbol.type) {
      case 'circle':
        return <circle cx="5" cy="5" r="5" fill={symbol.fill} />;
      case 'diamond':
        return <polygon points="5,0 10,5 5,10 0,5" fill={symbol.fill} />;
      case 'star':
        return <polygon points="5,0 6.5,3.5 10,4 7.5,6.5 8,10 5,8 2,10 2.5,6.5 0,4 3.5,3.5" fill={symbol.fill} />;
      case 'triangleUp':
        return <polygon points="5,0 10,10 0,10" fill={symbol.fill} />;
      case 'triangleDown':
        return <polygon points="0,0 10,0 5,10" fill={symbol.fill} />;
      default:
        return <rect width="10" height="10" fill={symbol.fill} />;
    }
  };

  private handleToggleSeries = (name?: string): void => {
    if (name === undefined) {
      return;
    }
    this.setState(prevState => {
      const next = new Set(prevState.hiddenSeries);
      if (!next.delete(name)) {
        next.add(name);
      }
      return { hiddenSeries: next };
    });
  };

  private buildFullLegendData = (): LegendItem[] => {
    return this.props.data.map(s => {
      const name = s.legendItem.name;

      if (this.state.hiddenSeries.has(name)) {
        return { name, symbol: { ...s.legendItem.symbol, fill: PFColors.Color200 } };
      }

      return { ...s.legendItem, name };
    });
  };

  private scaledAxisInfo = (data: VCLines<VCDataPoint & T>): ScaleInfo => {
    const ticks = Math.max(...data.map(s => s.datapoints.length));

    if (this.state.width < 500) {
      return {
        count: Math.min(5, ticks),
        format: '%H:%M'
      };
    } else if (this.state.width < 700) {
      return {
        count: Math.min(10, ticks),
        format: '%H:%M'
      };
    }

    return {
      count: Math.min(15, ticks),
      format: '%H:%M:%S'
    };
  };

  private normalizeOverlay = (factor: number): (VCDataPoint & O)[] => {
    // All data is relative to the first Y-axis, even if a second one is in use
    // To make it appear as relative to the second axis, we need to normalize it, ie. apply the same scale factor that exists between the two axis
    // This scale factor is stored in every datapoint so that it can be "reverted" when we need to retrieve the original value, e.g. in tooltips
    return this.props.overlay!.vcLine.datapoints.map(dp => ({ ...dp, y: dp.y * factor, scaleFactor: factor }));
  };
}
