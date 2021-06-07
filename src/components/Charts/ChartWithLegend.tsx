import * as React from 'react';
import { Chart, ChartGroup, ChartScatter, ChartProps, ChartTooltipProps } from '@patternfly/react-charts';
import { VictoryAxis, VictoryBoxPlot, VictoryLabel, VictoryLegend, VictoryPortal, VictoryTheme } from 'victory';
import { format as d3Format } from 'd3-format';
import './Charts.css';
import { getFormatter, getUnit } from 'utils/Formatter';
import { VCLines, LegendItem, LineInfo, RichDataPoint, RawOrBucket, VCDataPoint } from 'types/VictoryChartInfo';
import { Overlay } from 'types/Overlay';
import { newBrushVoronoiContainer, BrushHandlers } from './Container';
import { buildLegendInfo, toBuckets } from 'utils/VictoryChartsUtils';
import { VCEvent, addLegendEvent } from 'utils/VictoryEvents';
import { XAxisType } from 'types/Dashboards';
import { CustomTooltip } from './CustomTooltip';
import { INTERPOTALION_STRATEGY } from './SparklineChart';

type Props<T extends RichDataPoint, O extends LineInfo> = {
  chartHeight?: number;
  data: VCLines<T & VCDataPoint>;
  seriesComponent: React.ReactElement;
  overrideSeriesComponentStyle?: boolean;
  stroke?: boolean;
  fill?: boolean;
  showSpans?: boolean;
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
class ChartWithLegend<T extends RichDataPoint, O extends LineInfo> extends React.Component<Props<T, O>, State> {
  containerRef: React.RefObject<HTMLDivElement>;
  hoveredItem?: VCDataPoint;
  mouseOnLegend = false;

  constructor(props: Props<T, O>) {
    super(props);
    this.containerRef = React.createRef<HTMLDivElement>();
    this.state = { width: 0, hiddenSeries: new Set([overlayName]) };
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

  render() {
    const scaleInfo = this.scaledAxisInfo(this.props.data);
    const legendData = this.buildLegendData();
    const chartHeight = this.props.chartHeight || 300;
    const legend = buildLegendInfo(legendData, this.state.width, chartHeight);
    const overlayIdx = this.props.data.length;
    const showOverlay = (this.props.overlay && this.props.showSpans) || false;
    const overlayRightPadding = showOverlay ? 15 : 0;
    const padding: Padding = { top: 10, bottom: 20, left: 40, right: 10 + overlayRightPadding };
    padding.bottom += legend.height;

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
    this.props.data.forEach((s, idx) => this.registerEvents(events, idx, 'serie-' + idx, s.legendItem.name));
    let useSecondAxis = showOverlay;
    let normalizedOverlay: RawOrBucket<O>[] = [];
    let overlayFactor = 1.0;
    const mainMax = Math.max(...this.props.data.map(line => Math.max(...line.datapoints.map(d => d.y))));
    if (this.props.overlay) {
      this.registerEvents(events, overlayIdx, overlayName, overlayName);
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

    return (
      <div ref={this.containerRef} style={{ marginTop: '10px', height: chartHeight }}>
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
          {this.props.xAxis === 'series' ? (
            <VictoryAxis
              domain={[0, filteredData.length + 1]}
              style={AxisStyle}
              tickValues={filteredData.map(s => s.legendItem.name)}
              theme={VictoryTheme.material}
              tickFormat={() => ''}
            />
          ) : (
            <VictoryAxis
              tickCount={scaleInfo.count}
              style={AxisStyle}
              theme={VictoryTheme.material}
              domain={this.props.timeWindow}
            />
          )}
          <VictoryAxis
            tickLabelComponent={
              <VictoryPortal>
                <VictoryLabel />
              </VictoryPortal>
            }
            dependentAxis={true}
            tickFormat={getFormatter(d3Format, this.props.unit)}
            label={getUnit(d3Format, this.props.unit, mainMax)}
            axisLabelComponent={<VictoryLabel y={5} x={20} angle={0} renderInPortal={true} />}
            theme={VictoryTheme.material}
            style={AxisStyle}
          />
          {useSecondAxis && this.props.overlay && (
            <VictoryAxis
              dependentAxis={true}
              offsetX={this.state.width - overlayRightPadding}
              style={AxisStyle}
              tickFormat={t => getFormatter(d3Format, this.props.overlay?.info.lineInfo.unit || '')(t / overlayFactor)}
              tickLabelComponent={<VictoryLabel dx={15} textAnchor={'start'} />}
              theme={VictoryTheme.material}
              label={getUnit(
                d3Format,
                this.props.overlay?.info.lineInfo.unit || '',
                Math.max(...this.props.overlay.vcLine.datapoints.map(d => d.y))
              )}
              axisLabelComponent={
                <VictoryLabel y={5} x={this.state.width - overlayRightPadding} angle={0} renderInPortal={true} />
              }
            />
          )}
          {this.props.xAxis === 'series' ? this.renderCategories() : this.renderTimeSeries(chartHeight - legend.height)}
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
          <VictoryLegend
            name={'serie-legend'}
            data={legendData}
            x={10}
            y={chartHeight - legend.height}
            height={legend.height}
            width={this.state.width}
            itemsPerRow={legend.itemsPerRow}
            style={{
              data: { cursor: 'pointer' },
              labels: { cursor: 'pointer', fontSize: legend.fontSizeLabels }
            }}
            borderPadding={{ top: 5 }}
            symbolSpacer={5}
          />
        </Chart>
      </div>
    );
  }

  private renderTimeSeries = (height: number) => {
    const groupOffset = this.props.groupOffset || 0;
    return (
      <ChartGroup offset={groupOffset} height={height}>
        {this.props.data.map((serie, idx) => {
          if (this.state.hiddenSeries.has(serie.legendItem.name)) {
            return undefined;
          }
          return React.cloneElement(
            this.props.seriesComponent,
            this.withStyle(
              {
                key: 'serie-' + idx,
                name: 'serie-' + idx,
                data: serie.datapoints,
                interpolation: INTERPOTALION_STRATEGY
              },
              serie.color
            )
          );
        })}
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
  private withStyle = (props: any, color?: string) => {
    return this.props.overrideSeriesComponentStyle === false
      ? props
      : {
          ...props,
          style: { data: { fill: this.props.fill ? color : undefined, stroke: this.props.stroke ? color : undefined } }
        };
  };

  private handleResize = () => {
    if (this.containerRef && this.containerRef.current) {
      this.setState({ width: this.containerRef.current.clientWidth });
    }
  };

  private buildLegendData(): LegendItem[] {
    const truncate = this.props.data.length > 4;
    return this.props.data.map(s => {
      const name = truncate ? s.legendItem.name.slice(0, 8) : s.legendItem.name;
      if (this.state.hiddenSeries.has(s.legendItem.name)) {
        return { name, symbol: { ...s.legendItem.symbol, fill: '#72767b' } };
      }
      return { ...s.legendItem, name };
    });
  }

  private registerEvents(events: VCEvent[], idx: number, serieID: string, serieName: string) {
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
