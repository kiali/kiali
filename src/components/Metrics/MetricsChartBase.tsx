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

abstract class MetricsChartBase<Props extends MetricsChartBaseProps> extends React.Component<Props> {
  protected abstract get controlKey(): string;
  protected abstract get seriesData(): any;

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

  render() {
    const data = this.seriesData;
    const height = this.adjustHeight(data.columns);
    return (
      <div key={this.controlKey} style={{ height: '100%' }}>
        {this.props.onExpandRequested && this.renderExpand()}
        <LineChart
          style={{ height: this.props.onExpandRequested ? height : '99%' }}
          id={this.props.chartName}
          title={{ text: this.props.chartName }}
          data={data}
          axis={this.axisDefinition}
          point={{ show: false }}
        />
      </div>
    );
  }
}

export default MetricsChartBase;
