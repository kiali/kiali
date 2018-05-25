import * as React from 'react';
import { AreaChart } from 'patternfly-react';
import { PfColors } from '../../components/Pf/PfColors';

type LatencyChartTypeProp = {
  label: string;
  latAvg: [string, number][];
  latMed: [string, number][];
  lat95: [string, number][];
  lat99: [string, number][];
};

export default class LatencyChart extends React.Component<LatencyChartTypeProp, {}> {
  constructor(props: LatencyChartTypeProp) {
    super(props);
  }

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
      columns: (this.props.latAvg as [string, number][])
        .concat(this.props.latMed as [string, number][])
        .concat(this.props.lat95 as [string, number][])
        .concat(this.props.lat99 as [string, number][]),
      type: 'area-spline',
      hide: ['Average', 'Median', '99th']
    };

    return (
      <>
        <div>
          <strong>{this.props.label}:</strong>
        </div>
        <AreaChart
          size={{ height: 80 }}
          color={{ pattern: [PfColors.Black, PfColors.Green400, PfColors.Blue, PfColors.Orange400] }}
          legend={{ show: true }}
          grid={{ y: { show: false } }}
          axis={axis}
          data={chartData}
        />
      </>
    );
  }
}
