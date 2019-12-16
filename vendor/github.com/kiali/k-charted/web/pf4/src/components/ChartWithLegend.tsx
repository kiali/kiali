import * as React from 'react';
import { Chart, ChartGroup, ChartAxis, ChartScatter, ChartProps } from '@patternfly/react-charts';
import { VictoryLegend, VictoryPortal, VictoryLabel } from 'victory';
import { format as d3Format } from 'd3-format';

import { getFormatter } from '../../../common/utils/formatter';
import { VCLines, VCDataPoint, VCLine } from '../types/VictoryChartInfo';
import { Overlay } from '../types/Overlay';
import { createContainer } from './Container';
import { buildLegendInfo } from '../utils/victoryChartsUtils';

type Props = {
  data: VCLines;
  seriesComponent: React.ReactElement;
  unit: string;
  chartHeight?: number;
  groupOffset?: number;
  fill?: boolean;
  stroke?: boolean;
  moreChartProps?: ChartProps;
  overlay?: Overlay;
  onClick?: (datum: VCDataPoint) => void;
};

type State = {
  width: number;
  hiddenSeries: Set<number>;
};

class ChartWithLegend extends React.Component<Props, State> {
  containerRef: React.RefObject<HTMLDivElement>;

  constructor(props: Props) {
    super(props);
    this.containerRef = React.createRef<HTMLDivElement>();
    // Hidden series is initialized with the overlay index ( = data length )
    this.state = { width: 0, hiddenSeries: new Set([props.data.length]) };
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

    const dataWithOverlay = this.props.overlay ? this.props.data.concat(this.props.overlay.vcLine) : this.props.data;
    const overlayIdx = this.props.data.length;
    const showOverlay = this.props.overlay && !this.state.hiddenSeries.has(overlayIdx);
    const overlayRightPadding = showOverlay ? 30 : 0;

    const legend = buildLegendInfo(dataWithOverlay, this.state.width);
    const height = 300 + legend.height;
    const padding = { top: 10, bottom: 20, left: 40, right: 10 + overlayRightPadding };
    padding.bottom += legend.height;

    const events = this.props.data.map((_, idx) => this.registerEvents(idx, 'serie-' + idx));
    let overlayFactor = 1.0;
    if (this.props.overlay) {
      events.push(this.registerEvents(overlayIdx, 'overlay'));
      // Normalization for y-axis display to match y-axis domain of the main data
      // (see https://formidable.com/open-source/victory/gallery/multiple-dependent-axes/)
      const mainMax = Math.max(...this.props.data.map(line => Math.max(...line.datapoints.map(d => d.y))));
      const overlayMax = Math.max(...this.props.overlay.vcLine.datapoints.map(d => d.y));
      if (overlayMax !== 0) {
        overlayFactor = mainMax / overlayMax;
      }
    }
    const dataEvents: any[] = [];
    if (this.props.onClick) {
      dataEvents.push({
        target: 'data',
        eventHandlers: {
          onClick: (event, target) => {
            const series: VCDataPoint[] = target.data;
            const pos = event.clientX - padding.left;
            const size = this.state.width - padding.left - padding.right;
            const ratio = pos / size;
            const numFunc = (typeof series[0].x === 'object' ? x => x.getTime() : x => x);
            const xLength = numFunc(series[series.length - 1].x) - numFunc(series[0].x);
            const clickedX = numFunc(series[0].x) + ratio * xLength;
            // Find closest point
            const closest = series.reduce((p, c) => {
              if (p === null) {
                return c;
              }
              const dist = Math.abs(clickedX - numFunc(c.x));
              const prevDist = Math.abs(clickedX - numFunc(p.x));
              return dist < prevDist ? c : p;
            });
            this.props.onClick!(closest);
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
          containerComponent={createContainer()}
          scale={{x: 'time'}}
          {...this.props.moreChartProps}
        >
          <ChartGroup offset={groupOffset}>
            {this.props.data.map((serie, idx) => {
              if (this.state.hiddenSeries.has(idx)) {
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
          {showOverlay && (
            <ChartScatter key="overlay" name="overlay" data={this.normalizeOverlay(overlayFactor)} style={{ data: this.props.overlay!.info.dataStyle }} events={dataEvents} />
          )}
          <ChartAxis
            tickCount={scaleInfo.count}
            style={{ tickLabels: {fontSize: 12, padding: 2} }}
          />
          <ChartAxis
            tickLabelComponent={<VictoryPortal><VictoryLabel/></VictoryPortal>}
            dependentAxis={true}
            tickFormat={getFormatter(d3Format, this.props.unit)}
            style={{ tickLabels: {fontSize: 12, padding: 2} }}
          />
          {showOverlay && (
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
            data={dataWithOverlay.map((s, idx) => {
              if (this.state.hiddenSeries.has(idx)) {
                return { ...s.legendItem, symbol: { ...s.legendItem.symbol, fill: '#72767b' } };
              }
              return s.legendItem;
            })}
            x={50}
            y={height - legend.height}
            height={legend.height}
            width={this.state.width}
            itemsPerRow={legend.itemsPerRow}
          />
        </Chart>
      </div>
    );
  }

  private registerEvents(idx: number, serieName: string) {
    return {
      childName: ['serie-legend'],
      target: ['data', 'labels'],
      eventKey: String(idx),
      eventHandlers: {
        onMouseOver: () => {
          return [
            {
              childName: [serieName],
              target: 'data',
              eventKey: 'all',
              mutation: props => {
                return {
                  style: {...props.style,  strokeWidth: 4, fillOpacity: 0.5}
                };
              }
            }
          ];
        },
        onMouseOut: () => {
          return [
            {
              childName: [serieName],
              target: 'data',
              eventKey: 'all',
              mutation: () => {
                return null;
              }
            }
          ];
        },
        onClick: () => {
          return [
            {
              childName: [serieName],
              target: 'data',
              mutation: () => {
                if (!this.state.hiddenSeries.delete(idx)) {
                  // Was not already hidden => add to set
                  this.state.hiddenSeries.add(idx);
                }
                this.setState({ hiddenSeries: new Set(this.state.hiddenSeries) });
                return null;
              }
            },
            {
              childName: [serieName],
              target: 'data',
              eventKey: 'all',
              mutation: () => null
            }
          ];
        }
      },
    };
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

  private normalizeOverlay(factor: number) {
    return this.props.overlay!.vcLine.datapoints.map(dp => ({ ...dp, y: dp.y * factor, actualY: dp.y }));
  }
}

export default ChartWithLegend;
