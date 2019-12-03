import * as React from 'react';
import { style } from 'typestyle';
import { Button, Text, TextContent, TextVariants } from '@patternfly/react-core';
import { ChartArea, ChartBar, ChartLine } from '@patternfly/react-charts';
import { ExpandArrowsAltIcon, InfoAltIcon, ErrorCircleOIcon } from '@patternfly/react-icons';

import { ChartModel } from '../../../common/types/Dashboards';
import { VCLines, VCDataPoint } from '../types/VictoryChartInfo';
import { Overlay } from '../types/Overlay';
import ChartWithLegend from './ChartWithLegend';

type KChartProps = {
  chart: ChartModel;
  data: VCLines;
  expandHandler?: () => void;
  onClick?: (datum: VCDataPoint) => void;
  overlay?: Overlay;
};

const expandBlockStyle: React.CSSProperties = {
  marginBottom: '-1.5em',
  zIndex: 1,
  position: 'relative',
  textAlign: 'right'
};

const emptyMetricsStyle = style({
  width: '100%',
  height: 345,
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
        />
      </>
    );
  }

  private isEmpty(data: VCLines): boolean {
    return !data.some(s => s.datapoints.length !== 0);
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
}

export default KChart;
