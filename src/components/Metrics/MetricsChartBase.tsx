import * as React from 'react';
import { LineChart, Icon } from 'patternfly-react';
import { TimeSeries } from '../../types/Metrics';
import { style } from 'typestyle';

type MetricsChartBaseProps = {
  chartName: string;
  onExpandRequested?: () => void;
};

const expandBlockStyle = style({
  marginBottom: '-1.5em',
  zIndex: 1,
  position: 'relative',
  textAlign: 'right'
});

interface C3ChartData {
  x: string;
  columns: any[][];
  unload?: string[];
}

abstract class MetricsChartBase<Props extends MetricsChartBaseProps> extends React.Component<Props> {
  private previousColumns: string[] = [];

  protected abstract getControlKey(): string;
  protected abstract getSeriesData(): C3ChartData;

  protected nameTimeSeries = (matrix: TimeSeries[], groupName?: string): TimeSeries[] => {
    matrix.forEach(ts => {
      const labels = Object.keys(ts.metric)
        .map(k => ts.metric[k])
        .filter(label => label !== 'source' && label !== 'destination')
        .join(',');
      if (groupName) {
        if (labels === '') {
          // Ex: average // quantile 0.999 // etc.
          ts.name = groupName;
        } else {
          // Ex: policy: average // stadium: quantile 0.999 // etc.
          ts.name = labels + ': ' + groupName;
        }
      } else {
        if (labels === '') {
          // Ex: Request volume (ops)
          ts.name = this.props.chartName;
        } else {
          // Ex: policy // stadium // etc.
          ts.name = labels;
        }
      }
    });
    return matrix;
  };

  protected get axisDefinition() {
    return {
      x: {
        type: 'timeseries',
        tick: {
          fit: true,
          count: 15,
          multiline: false,
          format: '%H:%M:%S'
        }
      },
      y: {
        tick: {
          format: val => {
            // parseFloat is used to remove trailing zeros
            return parseFloat(val.toFixed(5));
          }
        }
      }
    };
  }

  adjustHeight(columns: any[]): number {
    const series = columns.length - 1;
    return 350 + series * 23;
  }

  protected onExpandHandler = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.onExpandRequested!();
  };

  protected renderExpand = () => {
    return (
      <div className={expandBlockStyle}>
        <a href="#" onClick={this.onExpandHandler}>
          Expand <Icon name="expand" type="fa" size="lg" title="Expand" />
        </a>
      </div>
    );
  };

  checkUnload(data: C3ChartData) {
    const newColumns = data.columns.map(c => c[0] as string);
    const diff = this.previousColumns.filter(col => !newColumns.includes(col));
    if (diff.length > 0) {
      data.unload = diff;
    }
    this.previousColumns = newColumns;
  }

  render() {
    const data = this.getSeriesData();
    this.checkUnload(data);
    const height = this.adjustHeight(data.columns);
    // Note: if any direct interaction is needed with the C3 chart,
    //  use "oninit" hook and reference "this" as the C3 chart object.
    //  see commented code
    // const self = this;
    return (
      <div key={this.getControlKey()} style={{ height: '100%' }}>
        {this.props.onExpandRequested && this.renderExpand()}
        <LineChart
          style={{ height: this.props.onExpandRequested ? height : '99%' }}
          id={this.props.chartName}
          title={{ text: this.props.chartName }}
          data={data}
          axis={this.axisDefinition}
          point={{ show: false }}
          // oninit={function(this: any) {
          //   self.chartRef = this;
          // }}
        />
      </div>
    );
  }
}

export default MetricsChartBase;
