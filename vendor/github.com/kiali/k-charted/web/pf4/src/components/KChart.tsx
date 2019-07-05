import * as React from 'react';
import { style } from 'typestyle';
import { Text, TextContent, TextVariants } from '@patternfly/react-core';
import { Chart, ChartArea, ChartGroup, ChartLegend, ChartVoronoiContainer, ChartThemeColor, ChartAxis, ChartTooltip } from '@patternfly/react-charts';
import { ExpandArrowsAltIcon, InfoAltIcon, ErrorCircleOIcon } from '@patternfly/react-icons';
import { format as d3Format } from 'd3-format';

import { ChartModel } from '../../../common/types/Dashboards';
import { getFormatter } from '../../../common/utils/formatter';
import { VictoryChartInfo } from '../types/VictoryChartInfo';

const { VictoryPortal, VictoryLabel } = require('victory');

type KChartProps = {
  chart: ChartModel;
  expandHandler?: () => void;
  dataSupplier: () => VictoryChartInfo;
  chartHeight?: number;
};

type State = {
  width: number
};

const defaultChartHeight = 300;
const legendHeight = 45;

const expandBlockStyle: React.CSSProperties = {
  marginBottom: '-1.5em',
  zIndex: 1,
  position: 'relative',
  textAlign: 'right'
};

const emptyMetricsStyle = style({
  width: '100%',
  height: defaultChartHeight + legendHeight,
  textAlign: 'center',
  $nest: {
    '& > p': {
      font: '14px sans-serif',
      margin: 0
    },
    '& div': {
      width: '100%',
      height: 'calc(100% - 5ex)',
      backgroundColor: '#fafafa',
      border: '1px solid #d1d1d1'
    },
    '& div p:first-child': {
      marginTop: '8ex'
    }
  }
});

class KChart extends React.Component<KChartProps, State> {
  containerRef = React.createRef<HTMLDivElement>();

  constructor(props: KChartProps) {
    super(props);
    this.state = { width: 0 };
  }

  handleResize = () => {
    if (this.containerRef.current) {
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

  onExpandHandler = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.expandHandler!();
  }

  renderExpand = () => {
    return (
      <div style={expandBlockStyle}>
        <a href="#" onClick={this.onExpandHandler}>
          Expand <ExpandArrowsAltIcon />
        </a>
      </div>
    );
  }

  render() {
    const data = this.props.dataSupplier();
    if (this.props.chart.error) {
      return this.renderError();
    } else if (this.isEmpty(data)) {
      return this.renderEmpty();
    }

    const formatter = getFormatter(d3Format, this.props.chart.unit);
    const height = this.props.chartHeight || defaultChartHeight;
    // rendering in portal doesn't seem to work
    // would be useful to make tooltip displayed above everything
    const tooltip = (
      <ChartTooltip
        renderInPortal={true}
        style={{ stroke: 'none' }}
      />
    );
    const container = (
      <ChartVoronoiContainer
        labels={dp => `${dp.name}: ${formatter(dp.y)}`}
        labelComponent={tooltip}
      />
    );
    const scaleInfo = this.scaledAxisInfo(data);

    return (
      <div ref={this.containerRef}>
        <TextContent>
          <Text component={TextVariants.h4} style={{textAlign: 'center'}}>{this.props.chart.name}</Text>
        </TextContent>
        <div className="area-chart-overflow">
          <Chart containerComponent={container}
            height={height}
            width={this.state.width}
            themeColor={ChartThemeColor.multi}
            scale={{x: 'time'}}>
            <ChartAxis
              tickCount={scaleInfo.count}
              style={{ tickLabels: {fontSize: 12, padding: 2} }}
            />
            <ChartAxis
              tickLabelComponent={<VictoryPortal><VictoryLabel/></VictoryPortal>}
              dependentAxis={true}
              tickFormat={formatter}
              style={{ tickLabels: {fontSize: 12, padding: 2} }}
            />
            <ChartGroup>
              {data.series.map((line, idx) => {
                return (<ChartArea key={'line-' + idx} data={line} />);
              })}
            </ChartGroup>
          </Chart>
        </div>
        <ChartLegend
          data={data.legend}
          height={legendHeight}
          responsive={false}
          themeColor={ChartThemeColor.multi}
          width={this.state.width}
        />
      </div>
    );
  }

  private isEmpty(data: VictoryChartInfo): boolean {
    return !data.series.some(s => s.length !== 0);
  }

  private renderEmpty() {
    return (
      <div className={emptyMetricsStyle}>
        <p>{this.props.chart.name}</p>
        <div>
          <p>
            <InfoAltIcon />
          </p>
          <p>No data available</p>
        </div>
      </div>
    );
  }

  private renderError() {
    return (
      <div className={emptyMetricsStyle}>
        <p>{this.props.chart.name}</p>
        <div>
          <p>
            <ErrorCircleOIcon style={{color: '#cc0000'}} />
          </p>
          <p>An error occured while fetching this metric:</p>
          <p><i>{this.props.chart.error}</i></p>
          <p>Please make sure the dashboard definition is correct.</p>
        </div>
      </div>
    );
  }

  private scaledAxisInfo(data: VictoryChartInfo) {
    const ticks = Math.max(...(data.series.map(s => s.length)));
    if ((window.innerWidth * this.props.chart.spans) / 12 < 500) {
      return {
        count: Math.min(5, ticks),
        format: '%H:%M'
      };
    } else if ((window.innerWidth * this.props.chart.spans) / 12 < 700) {
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
}

export default KChart;
