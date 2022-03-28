import * as React from 'react';
import { Chart, ChartGroup, ChartScatter, ChartProps, ChartTooltipProps } from '@patternfly/react-charts';
import { VictoryAxis, VictoryBoxPlot, VictoryLabel, VictoryLegend, VictoryPortal, VictoryTheme } from 'victory'
import { format as d3Format } from 'd3-format';
import { getFormatter, getUnit } from 'utils/Formatter';
import { VCLines, LegendItem, LineInfo, RichDataPoint, RawOrBucket, VCDataPoint } from 'types/VictoryChartInfo';
import { Overlay } from 'types/Overlay';
import { newBrushVoronoiContainer, BrushHandlers } from './Container';
import { toBuckets } from 'utils/VictoryChartsUtils';
import { VCEvent, addLegendEvent } from 'utils/VictoryEvents';
import { XAxisType } from 'types/Dashboards';
import { CustomTooltip } from './CustomTooltip';
import { INTERPOLATION_STRATEGY } from './SparklineChart';
import { KialiIcon } from '../../config/KialiIcon';
import { Button, ButtonVariant, Tooltip, TooltipPosition } from '@patternfly/react-core';
import regression from 'regression';
import { style } from 'typestyle';

type Props<T extends RichDataPoint, O extends LineInfo> = {
  chartHeight?: number;
  data: VCLines<T & VCDataPoint>;
  seriesComponent: React.ReactElement;
  overrideSeriesComponentStyle?: boolean;
  stroke?: boolean;
  fill?: boolean;
  showSpans?: boolean;
  showTrendline?: boolean;
  isMaximized?: boolean;
  groupOffset?: number;
  sizeRatio?: number;
  moreChartProps?: ChartProps;
  onClick?: (datum: RawOrBucket<O>) => void;
  brushHandlers?: BrushHandlers;
  overlay?: Overlay<O>;
  timeWindow?: [Date, Date];
  unit: string;
  xAxis?: XAxisType;
  labelComponent?: React.ReactElement<ChartTooltipProps>;
};

type State = {
  width: number;
  hiddenSeries: Set<string>;
  showMoreLegend: boolean;
};

type Padding = { top: number; left: number; right: number; bottom: number };

const overlayName = 'overlay';

const AxisStyle = {
  tickLabels: { fontSize: 12, padding: 2 },
  grid: {
    fill: 'none',
    stroke: '#ECEFF1',
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
const FONT_SIZE_LEGEND = 14;

const moreLegendIconStyle = style({
  margin: '0px 5px 2px 10px',
  verticalAlign: '-4px !important'
});

const noEnoughHeightStyle = style({
  margin: '0px 0px 0px 0px',
  verticalAlign: '-4px !important'
});

class ChartWithLegend<T extends RichDataPoint, O extends LineInfo> extends React.Component<Props<T, O>, State> {
  containerRef: React.RefObject<HTMLDivElement>;
  hoveredItem?: VCDataPoint;
  mouseOnLegend = false;

  constructor(props: Props<T, O>) {
    super(props);
    this.containerRef = React.createRef<HTMLDivElement>();
    this.state = {
      width: 0,
      hiddenSeries: new Set([overlayName]),
      showMoreLegend: false
    };
  }

  componentDidMount() {
    setTimeout(() => {
      this.handleResize();
      window.addEventListener('resize', this.handleResize);
    });
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
  }

  private onTooltipOpen = (points?: VCDataPoint[]) => {
    if (points && points.length > 0) {
      this.hoveredItem = points[0];
    } else {
      this.hoveredItem = undefined;
    }
  };

  private onTooltipClose = () => {
    this.hoveredItem = undefined;
  };

  private onShowMoreLegend = () => {
    this.setState(prevState => {
      return {
        showMoreLegend: !prevState.showMoreLegend
      };
    });
  };

  render() {
    const scaleInfo = this.scaledAxisInfo(this.props.data);
    const fullLegendData = this.buildFullLegendData();
    const filteredLegendData = this.buildFilteredLegendData(fullLegendData);
    const showMoreLegend = fullLegendData.length > filteredLegendData.length;
    const chartHeight = this.props.chartHeight || 300;
    const overlayIdx = this.props.data.length;
    const showOverlay = (this.props.overlay && this.props.showSpans) || false;
    const overlayRightPadding = showOverlay ? 15 : 0;
    const padding: Padding = {
      top: 0,
      bottom: chartHeight > MIN_HEIGHT_YAXIS ? LEGEND_HEIGHT : 0,
      left: 0,
      right: 10 + overlayRightPadding
    };

    const events: VCEvent[] = [];
    if (this.props.onClick) {
      events.push({
        target: 'parent',
        eventHandlers: {
          onClick: () => {
            if (this.hoveredItem) {
              this.props.onClick!(this.hoveredItem as RawOrBucket<O>);
            }
            return [];
          }
        }
      });
    }
    this.props.data.forEach((s, idx) =>
      this.registerEvents(events, idx, ['serie-' + idx, 'serie-reg-' + idx], s.legendItem.name)
    );
    let useSecondAxis = showOverlay;
    let normalizedOverlay: RawOrBucket<O>[] = [];
    let overlayFactor = 1.0;
    const mainMax = Math.max(...this.props.data.map(line => Math.max(...line.datapoints.map(d => d.y))));
    if (this.props.overlay) {
      this.registerEvents(events, overlayIdx, [overlayName], overlayName);
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

    const chart = (
      <div ref={this.containerRef} style={{ marginTop: '0px', height: chartHeight }}>
        <Chart
          width={this.state.width}
          padding={padding}
          events={events}
          height={chartHeight}
          containerComponent={newBrushVoronoiContainer(
            labelComponent,
            this.props.brushHandlers,
            () => this.mouseOnLegend
          )}
          scale={{ x: this.props.xAxis === 'series' ? 'linear' : 'time' }}
          // Hack: 1 pxl on Y domain padding to prevent harsh clipping (https://github.com/kiali/kiali/issues/2069)
          domainPadding={{ y: 1, x: this.props.xAxis === 'series' ? 50 : undefined }}
          {...this.props.moreChartProps}
        >
          {
            // Use width to change style of the x series supporting narrow scenarios
            this.props.xAxis === 'series' ? (
              <VictoryAxis
                domain={[0, filteredData.length + 1]}
                style={AxisStyle}
                tickValues={filteredData.map(s => s.legendItem.name)}
                theme={VictoryTheme.material}
                tickFormat={() => ''}
              />
            ) : this.state.width <= MIN_WIDTH ? (
              <VictoryAxis
                tickCount={scaleInfo.count}
                style={AxisStyle}
                theme={VictoryTheme.material}
                domain={this.props.timeWindow}
                tickFormat={t => {
                  return `:${t.getMinutes()}`;
                }}
              />
            ) : (
              <VictoryAxis
                tickCount={scaleInfo.count}
                style={AxisStyle}
                theme={VictoryTheme.material}
                domain={this.props.timeWindow}
              />
            )
          }
          <VictoryAxis
            tickLabelComponent={
              <VictoryPortal>
                <VictoryLabel />
              </VictoryPortal>
            }
            dependentAxis={true}
            tickCount={chartHeight <= MIN_HEIGHT_YAXIS ? 1 : undefined}
            tickFormat={getFormatter(d3Format, this.props.unit)}
            label={getUnit(d3Format, this.props.unit, mainMax)}
            axisLabelComponent={<VictoryLabel y={-10} x={-15} angle={0} renderInPortal={true} />}
            theme={VictoryTheme.material}
            style={AxisStyle}
          />
          {useSecondAxis && this.props.overlay && (
            <VictoryAxis
              dependentAxis={true}
              offsetX={this.state.width - overlayRightPadding}
              style={AxisStyle}
              tickCount={chartHeight <= MIN_HEIGHT_YAXIS ? 1 : undefined}
              tickFormat={t => getFormatter(d3Format, this.props.overlay?.info.lineInfo.unit || '')(t / overlayFactor)}
              tickLabelComponent={<VictoryLabel dx={15} textAnchor={'start'} />}
              theme={VictoryTheme.material}
              label={getUnit(
                d3Format,
                this.props.overlay?.info.lineInfo.unit || '',
                Math.max(...this.props.overlay.vcLine.datapoints.map(d => d.y))
              )}
              axisLabelComponent={<VictoryLabel y={-10} x={this.state.width} angle={0} renderInPortal={true} />}
            />
          )}
          {this.props.xAxis === 'series'
            ? this.renderCategories()
            : this.renderTimeSeries(chartHeight > MIN_HEIGHT_YAXIS ? chartHeight - LEGEND_HEIGHT : chartHeight)}
          {showOverlay &&
            (this.props.overlay!.info.buckets ? (
              <VictoryBoxPlot
                key="overlay"
                name={overlayName}
                data={normalizedOverlay}
                style={{
                  data: this.props.overlay!.info.dataStyle,
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
          {chartHeight > MIN_HEIGHT_YAXIS ? (
            <VictoryLegend
              name={'serie-legend'}
              data={filteredLegendData}
              x={0}
              y={chartHeight}
              height={LEGEND_HEIGHT}
              width={this.state.width}
              style={{
                data: { cursor: 'pointer', padding: 0 },
                labels: { cursor: 'pointer', fontSize: FONT_SIZE_LEGEND }
              }}
              borderPadding={{
                top: 5,
                left: 0,
                right: 0,
                bottom: 0
              }}
              symbolSpacer={5}
              gutter={{
                left: 0,
                right: 15
              }}
            />
          ) : undefined}
        </Chart>
        {showMoreLegend && chartHeight > MIN_HEIGHT_YAXIS && (
          <div
            style={{
              position: 'relative',
              left: this.state.width - 31,
              width: 16,
              height: 16
            }}
          >
            <Tooltip
              position={TooltipPosition.left}
              content={<div style={{ textAlign: 'left' }}>Show full legend</div>}
            >
              <Button variant={ButtonVariant.link} isInline onClick={() => this.onShowMoreLegend()}>
                <KialiIcon.MoreLegend className={moreLegendIconStyle} />
              </Button>
            </Tooltip>
          </div>
        )}
        {this.state.showMoreLegend && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              flexDirection: 'column',
              position: 'relative',
              width: this.state.width,
              height: chartHeight,
              top: -(chartHeight + LEGEND_HEIGHT),
              background: 'var(--pf-global--BackgroundColor--dark-100)',
              opacity: 0.7,
              overflow: 'auto'
            }}
          >
            {fullLegendData.map(ld => (
              <div
                style={{
                  color: 'white',
                  margin: 'auto'
                }}
              >
                <div
                  style={{
                    display: 'inline-block',
                    backgroundColor: ld.symbol.fill,
                    marginRight: '5px',
                    width: '9px',
                    height: '9px'
                  }}
                ></div>
                {ld.name}
              </div>
            ))}
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
          content={<div style={{ textAlign: 'left' }}>Increase height of the chart</div>}
        >
          <Button variant={ButtonVariant.link} isInline>
            <KialiIcon.MoreLegend className={noEnoughHeightStyle} />
          </Button>
        </Tooltip>
      </div>
    );
  }

  private renderTimeSeries = (height: number) => {
    const groupOffset = this.props.groupOffset || 0;
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
                  key: 'serie-' + idx,
                  name: 'serie-' + idx,
                  data: serie.datapoints,
                  interpolation: INTERPOLATION_STRATEGY
                },
                serie.color
              )
            );

            // serie.datapoints may contain undefined values in certain scenarios i.e. "unknown" values
            if (this.props.showTrendline === true && serie.datapoints[0]) {
              const first_dpx = (serie.datapoints[0].x as Date).getTime() / 1000;
              const datapoints = serie.datapoints.map(d => [
                ((d.x as Date).getTime() / 1000 - first_dpx) / 10000,
                parseFloat(d.y.toString())
              ]);
              const linearRegression = regression.linear(datapoints, { precision: 10 });

              let regressionDatapoints = serie.datapoints.map(d => ({
                ...d,
                name: d.name + ' (trendline)',
                y: linearRegression.predict(((d.x as Date).getTime() / 1000 - first_dpx) / 10000)[1]
              }));

              const regressionPlot = React.cloneElement(
                this.props.seriesComponent,
                this.withStyle(
                  {
                    key: 'serie-reg-' + idx,
                    name: 'serie-reg-' + idx,
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

  private renderCategories = () => {
    let domainX = 1;
    const nbSeries = this.props.data.length - this.state.hiddenSeries.size;
    const size = ((this.props.sizeRatio || 1) * this.state.width) / Math.max(nbSeries, 1);
    return this.props.data.map((serie, idx) => {
      if (this.state.hiddenSeries.has(serie.legendItem.name)) {
        return undefined;
      }
      return React.cloneElement(
        this.props.seriesComponent,
        this.withStyle(
          {
            key: 'serie-' + idx,
            name: 'serie-' + idx,
            data: serie.datapoints.map(d => ({ size: size, ...d, x: domainX++ })),
            barWidth: size
          },
          serie.color
        )
      );
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private withStyle = (props: any, color?: string, strokeDasharray?: boolean) => {
    return this.props.overrideSeriesComponentStyle === false
      ? props
      : {
          ...props,
          style: {
            data: {
              fill: this.props.fill ? color : undefined,
              stroke: this.props.stroke ? color : undefined,
              strokeDasharray: strokeDasharray === true ? '3 5' : undefined
            }
          }
        };
  };

  private handleResize = () => {
    if (this.containerRef && this.containerRef.current) {
      this.setState({ width: this.containerRef.current.clientWidth });
    }
  };

  private buildFullLegendData(): LegendItem[] {
    return this.props.data.map(s => {
      const name = s.legendItem.name;
      if (this.state.hiddenSeries.has(s.legendItem.name)) {
        return { name, symbol: { ...s.legendItem.symbol, fill: '#72767b' } };
      }
      return { ...s.legendItem, name };
    });
  }

  private buildFilteredLegendData(fullLegendData: LegendItem[]): LegendItem[] {
    // 30px == "more legend" left button width
    // 10px == "more legend" left padding
    const maxWidth = this.state.width - 30 - 10;
    const filtered: LegendItem[] = [];
    let currentWidth = 0;
    for (let i = 0; i < fullLegendData.length; i++) {
      const item = fullLegendData[i];
      // 12px == legend icon + space
      // 7px == char size
      // 15px == right padding
      currentWidth += 12 + item.name.length * 7 + 15;
      if (currentWidth >= maxWidth) {
        break;
      }
      filtered.push(item);
    }
    return filtered;
  }

  private registerEvents(events: VCEvent[], idx: number, serieID: string[], serieName: string) {
    addLegendEvent(events, {
      legendName: 'serie-legend',
      idx: idx,
      serieID: serieID,
      onMouseOver: props => {
        this.mouseOnLegend = true;
        return serieName === 'overlay'
          ? null
          : {
              style: { ...props.style, strokeWidth: 4, fillOpacity: 0 }
            };
      },
      onMouseOut: () => {
        this.mouseOnLegend = false;
        return null;
      },
      onClick: () => {
        if (!this.state.hiddenSeries.delete(serieName)) {
          // Was not already hidden => add to set
          this.state.hiddenSeries.add(serieName);
        }
        this.setState({ hiddenSeries: new Set(this.state.hiddenSeries) });
        return null;
      }
    });
  }

  private scaledAxisInfo(data: VCLines<VCDataPoint & T>) {
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
  }

  private normalizeOverlay(factor: number): (VCDataPoint & O)[] {
    // All data is relative to the first Y-axis, even if a second one is in use
    // To make it appear as relative to the second axis, we need to normalize it, ie. apply the same scale factor that exists between the two axis
    // This scale factor is stored in every datapoint so that it can be "reverted" when we need to retrieve the original value, e.g. in tooltips
    return this.props.overlay!.vcLine.datapoints.map(dp => ({ ...dp, y: dp.y * factor, scaleFactor: factor }));
  }
}

export default ChartWithLegend;
