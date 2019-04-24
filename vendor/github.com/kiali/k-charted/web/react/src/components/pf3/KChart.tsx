import * as React from 'react';
import { style } from 'typestyle';
import { Icon, LineChart } from 'patternfly-react';
import { InfoAltIcon, ErrorCircleOIcon } from '@patternfly/react-icons';

import { getFormatter } from '../../utils/formatter';
import { C3ChartData } from '../../utils/c3ChartsUtils';
import { ChartModel } from '../../types/Dashboards';

const chartHeight = 350;

type KChartProps = {
  chart: ChartModel;
  expandHandler?: () => void;
  dataSupplier: () => C3ChartData;
};

const expandBlockStyle: React.CSSProperties = {
  marginBottom: '-1.5em',
  zIndex: 1,
  position: 'relative',
  textAlign: 'right'
};

const emptyMetricsStyle = style({
  width: '100%',
  height: chartHeight,
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

class KChart extends React.Component<KChartProps> {
  private previousColumns: string[] = [];

  onExpandHandler = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.expandHandler!();
  }

  renderExpand = () => {
    return (
      <div style={expandBlockStyle}>
        <a href="#" onClick={this.onExpandHandler}>
          Expand <Icon name="expand" type="fa" size="lg" title="Expand" />
        </a>
      </div>
    );
  }

  checkUnload(data: C3ChartData) {
    const newColumns = data.columns.map(c => c[0] as string);
    const diff = this.previousColumns.filter(col => !newColumns.includes(col));
    if (diff.length > 0) {
      data.unload = diff;
    }
    this.previousColumns = newColumns;
  }

  render() {
    const data = this.props.dataSupplier();
    this.checkUnload(data);
    if (this.props.chart.error) {
      return this.renderError();
    } else if (this.isEmpty(data)) {
      return this.renderEmpty();
    }
    const self = this;
    return (
      <div key={this.props.chart.name}>
        {this.props.expandHandler && this.renderExpand()}
        <LineChart
          style={{ height: this.props.expandHandler ? chartHeight : '99%' }}
          id={this.props.chart.name}
          title={{ text: this.props.chart.name }}
          data={data}
          axis={this.getAxisDefinition()}
          point={{ show: false }}
          onresized={function(this: any) {
            // Hack due to axis definition not being updated on resize
            const scaleInfo = self.scaledAxisInfo();
            this.config.axis_x_tick_count = scaleInfo.count;
            this.config.axis_x_tick_format = scaleInfo.format;
          }}
        />
      </div>
    );
  }

  private isEmpty(data: C3ChartData): boolean {
    // Get "x", which has the timestamps
    const timestamps = data.columns.find(val => val[0] === data.x);

    // If there are timestamps, assume there is data
    return !(timestamps && timestamps.length > 1);
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

  private getAxisDefinition() {
    const scaleInfo = this.scaledAxisInfo();
    return {
      x: {
        type: 'timeseries',
        tick: {
          fit: true,
          count: scaleInfo.count,
          multiline: false,
          format: scaleInfo.format
        }
      },
      y: {
        tick: {
          format: getFormatter(this.props.chart.unit)
        }
      }
    };
  }

  private scaledAxisInfo() {
    if ((window.innerWidth * this.props.chart.spans) / 12 < 450) {
      return {
        count: 5,
        format: '%H:%M'
      };
    } else if ((window.innerWidth * this.props.chart.spans) / 12 < 600) {
      return {
        count: 10,
        format: '%H:%M'
      };
    }
    return {
      count: 15,
      format: '%H:%M:%S'
    };
  }
}

export default KChart;
