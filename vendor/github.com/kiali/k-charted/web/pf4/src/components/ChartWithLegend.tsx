import * as React from 'react';
import { Chart, ChartGroup, ChartAxis, ChartScatter, ChartProps } from '@patternfly/react-charts';
import { VictoryLegend, VictoryPortal, VictoryLabel } from 'victory';
import { format as d3Format } from 'd3-format';

import { getFormatter } from '../../../common/utils/formatter';
import { VCLines, VCDataPoint } from '../types/VictoryChartInfo';
import { Overlay } from '../types/Overlay';
import { createContainer } from './Container';
import { buildLegendInfo, findClosestDatapoint } from '../utils/victoryChartsUtils';

type Props = {
  chartHeight?: number;
  data: VCLines;
  fill?: boolean;
  groupOffset?: number;
  moreChartProps?: ChartProps;
  onClick?: (datum: VCDataPoint) => void;
  overlay?: Overlay;
  seriesComponent: React.ReactElement;
  stroke?: boolean;
  timeWindow?: [Date, Date];
  unit: string;
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
    const height = (this.props.chartHeight || 300) + legend.height;
    const padding = { top: 10, bottom: 20, left: 40, right: 10 + overlayRightPadding };
    padding.bottom += legend.height;

    const events = this.props.data.map((_, idx) => this.registerEvents(idx, 'serie-' + idx));
    let overlayFactor = 1.0;
    let useSecondAxis = this.props.overlay !== undefined;
    if (this.props.overlay) {
      events.push(this.registerEvents(overlayIdx, 'overlay'));
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
    }
    const dataEvents: any[] = [];
    if (this.props.onClick) {
      dataEvents.push({
        target: 'data',
        eventHandlers: {
          onClick: event => {
            // We need to get coordinates relative to the SVG
            const svg = event.target.viewportElement;
            const pt = svg.createSVGPoint();
            pt.x = event.clientX;
            pt.y = event.clientY;
            const clicked = pt.matrixTransform(svg.getScreenCTM().inverse());
            const closest = findClosestDatapoint(
              this.props.data,
              clicked.x - padding.left,
              clicked.y - padding.top,
              this.state.width - padding.left - padding.right,
              height - padding.top - padding.bottom);
            if (closest) {
              this.props.onClick!(closest);
            }
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
          // Hack: 1 pxl on Y domain padding to prevent harsh clipping (https://github.com/kiali/kiali/issues/2069)
          domainPadding={{y: 1}}
          {...this.props.moreChartProps}
        >
          {showOverlay && (
            <ChartScatter key="overlay" name="overlay" data={this.normalizeOverlay(overlayFactor)} style={{ data: this.props.overlay!.info.dataStyle }} events={dataEvents} />
          )}
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
            style={{
              data: { cursor: 'pointer' },
              labels: { cursor: 'pointer' }
            }}
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
