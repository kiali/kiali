import * as React from 'react';

import { AreaChart } from 'patternfly-react';

type RpsChartTypeProp = {
  label: string;
  dataRps: number[];
  dataErrors: number[];
};

export class RpsChart extends React.Component<RpsChartTypeProp, {}> {
  constructor(props: RpsChartTypeProp) {
    super(props);
  }

  render() {
    let len = this.props.dataRps.length;
    let sum = 0;
    for (let i = 0; i < len; ++i) {
      sum += +this.props.dataRps[i];
    }
    const avgRps = len === 0 ? 0 : sum / len;

    len = this.props.dataErrors.length;
    sum = 0;
    for (let i = 0; i < len; ++i) {
      sum += +this.props.dataErrors[i];
    }
    const avgErr = len === 0 ? 0 : sum / len;
    const pctErr = avgRps === 0 ? 0 : avgErr / avgRps * 100;

    let rpsColumn: Array<any> = ['RPS'];
    let errorsColumn: Array<any> = ['Errors'];

    rpsColumn = rpsColumn.concat(this.props.dataRps);
    errorsColumn = errorsColumn.concat(this.props.dataErrors);

    return (
      <>
        <div>
          <strong>{this.props.label}: </strong>
          {avgRps.toFixed(2)}rps / {pctErr.toFixed(2)}%Err
        </div>
        <AreaChart
          size={{ height: 45 }}
          color={{ pattern: ['#0088ce', '#c00'] }}
          legend={{ show: false }}
          grid={{ y: { show: false } }}
          axis={{ x: { show: false }, y: { show: false } }}
          data={{
            columns: [rpsColumn, errorsColumn],
            type: 'area-spline'
          }}
        />
      </>
    );
  }
}
