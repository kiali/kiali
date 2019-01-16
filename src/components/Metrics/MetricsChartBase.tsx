import * as React from 'react';
import { LineChart, Icon } from 'patternfly-react';
import { style } from 'typestyle';
import { format } from 'd3-format';
import { TimeSeries, Metric, AllPromLabelsValues } from '../../types/Metrics';

type MetricsChartBaseProps = {
  chartName: string;
  unit: string;
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
        .filter(k => k !== 'reporter')
        .map(k => ts.metric[k])
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
          format: this.formatYAxis
        }
      }
    };
  }

  formatYAxis = (val: any): string => {
    const fmt = format('~s')(val);
    let si = '';
    // Insert space before SI
    // "fmt" can be something like:
    // - "9k" => we want "9 kB"
    // - "9" => we want "9 B"
    for (let i = fmt.length - 1; i >= 0; i--) {
      const c = fmt.charAt(i);
      if (c >= '0' && c <= '9') {
        return fmt.substr(0, i + 1) + ' ' + si + this.props.unit;
      }
      si = c + si;
    }
    // Weird: no number found?
    return fmt + this.props.unit;
  };

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

  protected isVisibleMetric(metric: Metric, labelValues: AllPromLabelsValues) {
    for (const promLabelName in metric) {
      if (metric.hasOwnProperty(promLabelName)) {
        const actualValue = metric[promLabelName];
        const values = labelValues.get(promLabelName);
        if (values && values.hasOwnProperty(actualValue) && !values[actualValue]) {
          return false;
        }
      }
    }
    return true;
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
    const data = this.getSeriesData();
    this.checkUnload(data);
    const height = 350;
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
