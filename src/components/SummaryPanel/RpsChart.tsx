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
    const lastRps = this.props.dataRps.slice(-1)[0];
    const lastErrors = this.props.dataErrors.slice(-1)[0];
    const lastErrorPercent = Math.round(1000 * lastErrors / lastRps) / 10;

    let rpsColumn: Array<any> = ['RPS'];
    let errorsColumn: Array<any> = ['Errors'];

    rpsColumn = rpsColumn.concat(this.props.dataRps);
    errorsColumn = errorsColumn.concat(this.props.dataErrors);

    return (
      <>
        <div>
          <strong>{this.props.label}: </strong>
          {lastRps} RPS / {lastErrorPercent}% Error
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
