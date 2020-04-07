import * as React from 'react';
import { Chart, ChartGroup, ChartAxis, ChartScatter, ChartProps } from '@patternfly/react-charts';
import { VictoryLegend, VictoryPortal, VictoryLabel } from 'victory';
import { format as d3Format } from 'd3-format';

import { getFormatter } from '../../../common/utils/formatter';
import { VCLines, VCDataPoint, LegendItem } from '../types/VictoryChartInfo';
import { Overlay } from '../types/Overlay';
import { newBrushVoronoiContainer, BrushHandlers } from './Container';
import { buildLegendInfo, findClosestDatapoint } from '../utils/victoryChartsUtils';
import { VCEvent, addLegendEvent } from '../utils/events';

type Props = {
  chartHeight?: number;
  data: VCLines;
  fill?: boolean;
  groupOffset?: number;
  moreChartProps?: ChartProps;
  onClick?: (datum: VCDataPoint) => void;
  brushHandlers?: BrushHandlers;
  overlay?: Overlay;
  seriesComponent: React.ReactElement;
  stroke?: boolean;
  timeWindow?: [Date, Date];
  unit: string;
};

type State = {
  width: number;
  hiddenSeries: Set<string>;
};

const overlayName = 'overlay';

class ChartWithLegend extends React.Component<Props, State> {
  containerRef: React.RefObject<HTMLDivElement>;

  constructor(props: Props) {
    super(props);
    this.containerRef = React.createRef<HTMLDivElement>();
    this.state = { width: 0, hiddenSeries: new Set([overlayName]) };
  }

  handleResize = () => {
    if (this.containerRef && this.containerRef.current) {
      this.setState({ width: this.containerRef.current.clientWidth });
    }
  };

  componentDidMount() {
    setTimeout(() => {
      this.handleResize();
      window.addEventListener('resize', this.handleResize);
    });
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
  }

  render() {
    const scaleInfo = this.scaledAxisInfo(this.props.data);
    const groupOffset = this.props.groupOffset || 0;

    const legendData = this.buildLegendData();
    const legend = buildLegendInfo(legendData, this.state.width);
    const overlayIdx = this.props.data.length;
    const showOverlay = this.props.overlay && !this.state.hiddenSeries.has(overlayName);
    const overlayRightPadding = showOverlay ? 30 : 0;

    const height = (this.props.chartHeight || 300) + legend.height;
    const padding = { top: 10, bottom: 20, left: 40, right: 10 + overlayRightPadding };
    padding.bottom += legend.height;

    const events: VCEvent[] = [];
    this.props.data.forEach((s, idx) => this.registerEvents(events, idx, 'serie-' + idx, s.legendItem.name));
    let useSecondAxis = showOverlay;
    let normalizedOverlay: VCDataPoint[] = [];
    let overlayFactor = 1.0;
    if (this.props.overlay) {
      this.registerEvents(events, overlayIdx, overlayName, overlayName);
      // Normalization for y-axis display to match y-axis domain of the main data
      // (see https://formidable.com/open-source/victory/gallery/multiple-dependent-axes/)
      const mainMax = Math.max(...this.props.data.map(line => Math.max(...line.datapoints.map(d => d.y))));
      const overlayMax = Math.max(...this.props.overlay.vcLine.datapoints.map(d => d.y));
      if (overlayMax !== 0) {
        overlayFactor = mainMax / overlayMax;
      }
      if (this.props.unit === this.props.overlay.info.unit && overlayFactor > 0.5 && overlayFactor < 2) {
        // Looks like it's fine to re-use the existing axis
        useSecondAxis = false;
        overlayFactor = 1.0;
      }
      normalizedOverlay = this.normalizeOverlay(overlayFactor);
    }
    const dataEvents: any[] = [];
    let onClick: ((event: any) => void) | undefined = undefined;
    if (this.props.onClick) {
      onClick = (event: any) => {
        // We need to get coordinates relative to the SVG
        const svg = event.target.viewportElement;
        const pt = svg.createSVGPoint();
        pt.x = event.clientX;
        pt.y = event.clientY;
        const clicked = pt.matrixTransform(svg.getScreenCTM().inverse());
        let flatDP: VCDataPoint[] = this.props.data.flatMap<VCDataPoint>(line => line.datapoints);
        if (showOverlay) {
          flatDP = flatDP.concat(normalizedOverlay);
        }
        const closest = findClosestDatapoint(
          flatDP,
          clicked.x - padding.left,
          clicked.y - padding.top,
          this.state.width - padding.left - padding.right,
          height - padding.top - padding.bottom);
        if (closest) {
          this.props.onClick!(closest);
        }
      };

      dataEvents.push({
        target: 'data',
        eventHandlers: {
          onClick: event => {
            onClick!(event);
            return [];
          }
        }
      });
    }

    return (
      <div ref={this.containerRef}>
        <Chart
          height={height}
          width={this.state.width}
          padding={padding}
          events={events}
          containerComponent={newBrushVoronoiContainer(onClick, this.props.brushHandlers)}
          scale={{x: 'time'}}
          // Hack: 1 pxl on Y domain padding to prevent harsh clipping (https://github.com/kiali/kiali/issues/2069)
          domainPadding={{y: 1}}
          {...this.props.moreChartProps}
        >
          {showOverlay && (
            <ChartScatter key="overlay" name={overlayName} data={normalizedOverlay} style={{ data: this.props.overlay!.info.dataStyle }} events={dataEvents} />
          )}
          <ChartGroup offset={groupOffset}>
            {this.props.data.map((serie, idx) => {
              if (this.state.hiddenSeries.has(serie.legendItem.name)) {
                return undefined;
              }
              return React.cloneElement(this.props.seriesComponent, {
                key: 'serie-' + idx,
                name: 'serie-' + idx,
                data: serie.datapoints,
                events: dataEvents,
                style: { data: { fill: this.props.fill ? serie.color : undefined, stroke: this.props.stroke ? serie.color : undefined }}
              });
            })}
          </ChartGroup>
          <ChartAxis
            tickCount={scaleInfo.count}
            style={{ tickLabels: {fontSize: 12, padding: 2} }}
            domain={this.props.timeWindow}
          />
          <ChartAxis
            tickLabelComponent={<VictoryPortal><VictoryLabel/></VictoryPortal>}
            dependentAxis={true}
            tickFormat={getFormatter(d3Format, this.props.unit)}
            style={{ tickLabels: {fontSize: 12, padding: 2} }}
          />
          {useSecondAxis && (
            <ChartAxis
              dependentAxis={true}
              offsetX={this.state.width - overlayRightPadding}
              style={{
                axisLabel: { padding: -25 }
              }}
              tickFormat={t => getFormatter(d3Format, this.props.overlay ? this.props.overlay.info.unit : '')(t / overlayFactor)}
              label={this.props.overlay!.info.title}
            />
          )}
          <VictoryLegend
            name={'serie-legend'}
            data={legendData}
            x={50}
            y={height - legend.height}
            height={legend.height}
            width={this.state.width}
            itemsPerRow={legend.itemsPerRow}
            style={{
              data: { cursor: 'pointer' },
              labels: { cursor: 'pointer' }
            }}
          />
        </Chart>
      </div>
    );
  }

  private buildLegendData(): LegendItem[] {
    const items = this.props.data.map(s => {
      if (this.state.hiddenSeries.has(s.legendItem.name)) {
        return { ...s.legendItem, symbol: { ...s.legendItem.symbol, fill: '#72767b' } };
      }
      return s.legendItem;
    });
    if (this.props.overlay) {
      let item = this.props.overlay.vcLine.legendItem;
      if (this.state.hiddenSeries.has(overlayName)) {
        item = { ...item, symbol: { ...item.symbol, fill: '#72767b' } };
      }
      items.push(item);
    }
    return items;
  }

  private registerEvents(events: VCEvent[], idx: number, serieID: string, serieName: string) {
    addLegendEvent(events, {
      legendName: 'serie-legend',
      idx: idx,
      serieID: serieID,
      onMouseOver: props => {
        return {
          style: {...props.style,  strokeWidth: 4, fillOpacity: 0.5}
        };
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

  private scaledAxisInfo(data: VCLines) {
    const ticks = Math.max(...(data.map(s => s.datapoints.length)));
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

  private normalizeOverlay(factor: number): VCDataPoint[] {
    return this.props.overlay!.vcLine.datapoints.map(dp => ({ ...dp, y: dp.y * factor, actualY: dp.y }));
  }
}

export default ChartWithLegend;
