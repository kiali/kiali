import * as React from 'react';

import { AreaChart } from 'patternfly-react';

type RpsChartTypeProp = {
  label: string;
  dataRps: number[] | [string, number][];
  dataErrors: number[] | [string, number][];
};

export class RpsChart extends React.Component<RpsChartTypeProp, {}> {
  constructor(props: RpsChartTypeProp) {
    super(props);
  }

  render() {
    let dataRps: any[] = [],
      dataErrors: any[] = [],
      firstDataIdx = 0;
    let chartData = {};
    let axis: any = { x: { show: false }, y: { show: false } };

    if (Array.isArray(this.props.dataRps[0])) {
      dataRps = (this.props.dataRps as [string, number][])[1];
      dataErrors = (this.props.dataErrors as [string, number][])[1];
      firstDataIdx = 1;

      chartData = {
        x: 'x',
        columns: (this.props.dataRps as [string, number][]).concat(this.props.dataErrors as [string, number][]),
        type: 'area-spline'
      };
      axis.x = {
        show: false,
        type: 'timeseries',
        tick: {
          fit: true,
          count: 15,
          multiline: false,
          format: '%H:%M:%S'
        }
      };
    } else {
      dataRps = this.props.dataRps;
      dataErrors = this.props.dataErrors;

      let rpsColumn: Array<any> = ['RPS'];
      let errorsColumn: Array<any> = ['Errors'];

      rpsColumn = rpsColumn.concat(this.props.dataRps);
      errorsColumn = errorsColumn.concat(this.props.dataErrors);

      chartData = {
        columns: [rpsColumn, errorsColumn],
        type: 'area-spline'
      };
    }

    let len = dataRps.length;
    let sum = 0;
    for (let i = firstDataIdx; i < len; ++i) {
      sum += +dataRps[i];
    }
    const avgRps = len === 0 ? 0 : sum / len;

    len = dataErrors.length;
    sum = 0;
    for (let i = firstDataIdx; i < len; ++i) {
      sum += +dataErrors[i];
    }
    const avgErr = len === 0 ? 0 : sum / len;
    const pctErr = avgRps === 0 ? 0 : avgErr / avgRps * 100;

    return (
      <>
        <div>
          <strong>{this.props.label}: </strong>
          {avgRps.toFixed(2)}rps / {pctErr.toFixed(2)}%Err
        </div>
        {this.props.dataRps.length > 0 && (
          <AreaChart
            size={{ height: 45 }}
            color={{ pattern: ['#0088ce', '#c00'] }}
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
