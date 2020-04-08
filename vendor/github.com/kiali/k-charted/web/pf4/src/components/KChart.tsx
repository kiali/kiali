import * as React from 'react';
import { style } from 'typestyle';
import { Button, Text, TextContent, TextVariants } from '@patternfly/react-core';
import { ChartArea, ChartBar, ChartScatter, ChartLine } from '@patternfly/react-charts';
import { ExpandArrowsAltIcon, ErrorCircleOIcon } from '@patternfly/react-icons';

import { ChartModel } from '../../../common/types/Dashboards';
import { VCLines, VCDataPoint } from '../types/VictoryChartInfo';
import { Overlay } from '../types/Overlay';
import ChartWithLegend from './ChartWithLegend';
import { BrushHandlers } from './Container';

type KChartProps = {
  chart: ChartModel;
  data: VCLines;
  expandHandler?: () => void;
  onClick?: (datum: VCDataPoint) => void;
  brushHandlers?: BrushHandlers;
  overlay?: Overlay;
  timeWindow?: [Date, Date];
};

const expandBlockStyle: React.CSSProperties = {
  marginBottom: '-1.5em',
  zIndex: 1,
  position: 'relative',
  textAlign: 'right'
};

const noMetricsStyle = style({
  width: '100%',
  textAlign: 'center',
  $nest: {
    '& > p': {
      font: '14px sans-serif',
      margin: 0,
      padding: 32,
      paddingTop: 20
    }
  }
});

class KChart extends React.Component<KChartProps, {}> {
  onExpandHandler = () => {
    this.props.expandHandler!();
  }

  renderExpand = () => {
    return (
      <div style={expandBlockStyle}>
        <Button onClick={this.onExpandHandler}>
          Expand <ExpandArrowsAltIcon />
        </Button>
      </div>
    );
  }

  render() {
    if (this.props.chart.error) {
      return this.renderError();
    } else if (this.isEmpty(this.props.data)) {
      return this.renderEmpty();
    }

    let fill = false;
    let stroke = true;
    let seriesComponent = (<ChartLine/>);
    if (this.props.chart.chartType === 'area') {
      fill = true;
      stroke = false;
      seriesComponent = (<ChartArea/>);
    } else if (this.props.chart.chartType === 'bar') {
      fill = true;
      stroke = false;
      seriesComponent = (<ChartBar/>);
    } else if (this.props.chart.chartType === 'scatter') {
      fill = true;
      stroke = false;
      seriesComponent = (<ChartScatter/>);
    }

    const groupOffset = this.props.chart.chartType === 'bar' ? 7 : 0;
    const minDomain = this.props.chart.min === undefined ? undefined : { y: this.props.chart.min };
    const maxDomain = this.props.chart.max === undefined ? undefined : { y: this.props.chart.max };

    return (
      <>
        <TextContent>
          <Text component={TextVariants.h4} style={{textAlign: 'center'}}>{this.props.chart.name}</Text>
        </TextContent>
        <ChartWithLegend
          data={this.props.data}
          seriesComponent={seriesComponent}
          fill={fill}
          stroke={stroke}
          groupOffset={groupOffset}
          overlay={this.props.overlay}
          unit={this.props.chart.unit}
          moreChartProps={{ minDomain: minDomain, maxDomain: maxDomain }}
          onClick={this.props.onClick}
          brushHandlers={this.props.brushHandlers}
          timeWindow={this.props.timeWindow}
        />
      </>
    );
  }

  private isEmpty(data: VCLines): boolean {
    return !data.some(s => s.datapoints.length !== 0);
  }

  private renderNoMetric(jsx: JSX.Element) {
    return (
      <div className={noMetricsStyle}>
        <TextContent>
          <Text component={TextVariants.h4}>
            {this.props.chart.name}
          </Text>
        </TextContent>
        <TextContent style={{paddingTop: 20, paddingBottom: 30}}>
          <Text component={TextVariants.h5}>{jsx}</Text>
        </TextContent>
      </div>
    );
  }

  private renderEmpty() {
    return this.renderNoMetric(<>No data available</>);
  }

  private renderError() {
    return this.renderNoMetric((
      <>
        <ErrorCircleOIcon style={{color: '#cc0000', marginRight: 5}} />
        An error occured while fetching this metric:
        <p><i>{this.props.chart.error}</i></p>
      </>
    ));
  }
}

export default KChart;
