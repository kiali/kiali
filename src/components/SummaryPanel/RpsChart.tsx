import * as React from 'react';

import { AreaChart } from 'patternfly-react';

type RpsChartTypeProp = {
  label: string;
  dataRps: [string, number][];
  dataErrors: [string, number][];
};

export class RpsChart extends React.Component<RpsChartTypeProp, {}> {
  constructor(props: RpsChartTypeProp) {
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
      columns: (this.props.dataRps as [string, number][]).concat(this.props.dataErrors as [string, number][]),
      type: 'area-spline'
    };

    let dataRps: any = [],
      dataErrors: any = [];
    if (this.props.dataRps.length > 0) {
      dataRps = (this.props.dataRps as [string, number][])[1];
      dataErrors = (this.props.dataErrors as [string, number][])[1];
    }

    let len: number = dataRps.length;
    let sum = 0;
    for (let i = 1; i < len; ++i) {
      sum += +dataRps[i];
    }
    const avgRps = len === 0 ? 0 : sum / len;

    len = dataErrors.length;
    sum = 0;
    for (let i = 1; i < len; ++i) {
      sum += +dataErrors[i];
    }
    const avgErr = len === 0 ? 0 : sum / len;
    const pctErr = avgRps === 0 ? 0 : avgErr / avgRps * 100;

    return (
      <>
        <div>
          <strong>{this.props.label}: </strong>
          {avgRps.toFixed(2)} rps / {pctErr.toFixed(2)}% Err
        </div>
        {this.props.dataRps.length > 0 && (
          <AreaChart
            size={{ height: 45 }}
            color={{ pattern: ['#0088ce', '#cc0000'] }} // pf-blue, pf-red-100
            legend={{ show: false }}
            grid={{ y: { show: false } }}
            axis={axis}
            data={chartData}
          />
        )}
      </>
    );
  }
}
