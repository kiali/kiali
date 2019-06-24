import * as React from 'react';
import { AreaChart, Icon } from 'patternfly-react';
import { PfColors } from '../../components/Pf/PfColors';
import { SUMMARY_PANEL_CHART_WIDTH } from '../../types/Graph';

type ResponseTimeChartTypeProp = {
  label: string;
  rtAvg: [string | number][];
  rtMed: [string | number][];
  rt95: [string | number][];
  rt99: [string | number][];
  hide?: boolean;
};

export default class ResponseTimeChart extends React.Component<ResponseTimeChartTypeProp, {}> {
  thereIsTrafficData = () => {
    return this.props.rtAvg && this.props.rtAvg.length > 1 && this.props.rtAvg[0].length > 1;
  };

  // The prom data is in seconds but we want to report response times in millis when the user hovers
  // Convert the data points to millis.  The 'datums' is a bit complicated, it is a 2-dimensional array
  // that has 'x' arrays that hold timestamps of the datapoints for the x-axis.  And datapoint arrays that
  // hold the data for the quantiles.  We need only convert the data poiints.  A datums array can look like:
  // [['x', 123, 456, 789],
  //  ['avg', 0.10, 0.20, 0.30]
  //  ...
  // ]
  toMillis = (datums: [string | number][]) => {
    const millis = datums.map((datum: [any]) => {
      if (datum[0] === 'x') {
        return datum; // timestamps
      }
      return datum.map((dp, i) => {
        return i === 0 ? dp : dp * 1000.0;
      });
    });
    return millis;
  };

  render() {
    const axis: any = {
      x: {
        show: false,
        type: 'timeseries',
        tick: {
          fit: true,
          count: 15,
          multiline: false,
          format: '%H:%M:%S'
        }
      },
      y: { show: false }
    };

    const chartData = {
      x: 'x',
      columns: (this.toMillis(this.props.rtAvg) as [string | number][])
        .concat(this.toMillis(this.props.rtMed) as [string | number][])
        .concat(this.toMillis(this.props.rt95) as [string | number][])
        .concat(this.toMillis(this.props.rt99) as [string | number][]),
      type: 'area-spline',
      hide: ['Average', 'Median', '99th']
    };

    return (
      <>
        {!this.props.hide && (
          <div>
            <div>
              <strong>{this.props.label}:</strong>
            </div>
            {this.thereIsTrafficData() ? (
              <AreaChart
                size={{ height: 80, width: SUMMARY_PANEL_CHART_WIDTH }}
                color={{ pattern: [PfColors.Black, PfColors.Green400, PfColors.Blue, PfColors.Orange400] }}
                legend={{ show: true }}
                grid={{ y: { show: false } }}
                axis={axis}
                data={chartData}
              />
            ) : (
              <div>
                <Icon type="pf" name="info" /> Not enough traffic to generate chart.
              </div>
            )}
          </div>
        )}
      </>
    );
  }
}
