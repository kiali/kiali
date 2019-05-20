import * as React from 'react';
import { LineChart, Icon } from 'patternfly-react';
import { InfoAltIcon } from '@patternfly/react-icons';
import { style } from 'typestyle';
import { format } from 'd3-format';
import { TimeSeries, Metric, AllPromLabelsValues } from '../../types/Metrics';

const chartHeight = 350;

type MetricsChartBaseProps = {
  chartName: string;
  unit: string;
  spans: number;
  onExpandRequested?: () => void;
};

const expandBlockStyle = style({
  marginBottom: '-1.5em',
  zIndex: 1,
  position: 'relative',
  textAlign: 'right'
});

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

  formatYAxis = (val: number): string => {
    // Round to dismiss float imprecision
    val = Math.round(val * 10000) / 10000;
    switch (this.props.unit) {
      case 'seconds':
        return this.formatSI(val, 's');
      case 'bytes':
      case 'bytes-si':
        return this.formatDataSI(val, 'B');
      case 'bytes-iec':
        return this.formatDataIEC(val, 'B');
      case 'bitrate':
      case 'bitrate-si':
        return this.formatDataSI(val, 'bit/s');
      case 'bitrate-iec':
        return this.formatDataIEC(val, 'bit/s');
      default:
        // Fallback to default SI scaler:
        return this.formatDataSI(val, this.props.unit);
    }
  };

  formatDataSI = (val: number, suffix: string): string => {
    return this.formatData(val, 1000, ['k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']) + suffix;
  };

  formatDataIEC = (val: number, suffix: string): string => {
    return this.formatData(val, 1024, ['Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei', 'Zi', 'Yi']) + suffix;
  };

  formatData = (val: number, threshold: number, units: string[]): string => {
    if (Math.abs(val) < threshold) {
      return val + ' ';
    }
    let u = -1;
    do {
      val /= threshold;
      ++u;
    } while (Math.abs(val) >= threshold && u < units.length - 1);
    return format('~r')(val) + ' ' + units[u];
  };

  formatSI = (val: number, suffix: string): string => {
    const fmt = format('~s')(val);
    let si = '';
    // Insert space before SI
    // "fmt" can be something like:
    // - "9k" => we want "9 kB"
    // - "9" => we want "9 B"
    for (let i = fmt.length - 1; i >= 0; i--) {
      const c = fmt.charAt(i);
      if (c >= '0' && c <= '9') {
        return fmt.substr(0, i + 1) + ' ' + si + suffix;
      }
      si = c + si;
    }
    // Weird: no number found?
    return fmt + suffix;
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
    const hasData = this.hasData(data);
    this.checkUnload(data);
    // Note: if any direct interaction is needed with the C3 chart,
    //  use "oninit" hook and reference "this" as the C3 chart object.
    //  see commented code
    const self = this;
    return (
      <div key={this.getControlKey()}>
        {this.props.onExpandRequested && hasData && this.renderExpand()}
        {hasData ? (
          <LineChart
            style={{ height: this.props.onExpandRequested ? chartHeight : '99%' }}
            id={this.props.chartName}
            title={{ text: this.props.chartName }}
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
        ) : (
          <div className={emptyMetricsStyle}>
            <p>{this.props.chartName}</p>
            <div>
              <p>
                <InfoAltIcon />
              </p>
              <p>No data available</p>
            </div>
          </div>
        )}
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
          format: this.formatYAxis
        }
      }
    };
  }

  private hasData(data: C3ChartData): boolean {
    // Get "x", which has the timestamps
    const timestamps = data.columns.find(val => val[0] === data.x);

    // If there are timestamps, assume there is data
    return !!(timestamps && timestamps.length > 1);
  }

  private scaledAxisInfo() {
    if ((window.innerWidth * this.props.spans) / 12 < 450) {
      return {
        count: 5,
        format: '%H:%M'
      };
    } else if ((window.innerWidth * this.props.spans) / 12 < 600) {
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

export default MetricsChartBase;
