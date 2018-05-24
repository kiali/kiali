import * as React from 'react';
import { LineChart } from 'patternfly-react';
import { TimeSeries } from '../../types/Metrics';

type MetricsChartBaseProps = {
  familyName: string;
};

abstract class MetricsChartBase<Props extends MetricsChartBaseProps> extends React.Component<Props> {
  protected abstract get controlKey(): string;
  protected abstract get seriesData(): any;

  protected nameTimeSeries = (groupName: string, matrix: TimeSeries[]): TimeSeries[] => {
    matrix.forEach(ts => {
      const labels = Object.keys(ts.metric).map(k => ts.metric[k]);

      ts.name = this.props.familyName + groupName;
      if (labels.length !== 0) {
        ts.name += '{' + labels.join(',') + '}';
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

  render() {
    return (
      <div key={this.controlKey}>
        <LineChart
          id={this.props.familyName}
          title={{ text: this.props.familyName }}
          data={this.seriesData}
          axis={this.axisDefinition}
          point={{ show: false }}
        />
      </div>
    );
  }
}

export default MetricsChartBase;
