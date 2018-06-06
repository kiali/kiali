import * as React from 'react';
import { AreaChart } from 'patternfly-react';
import { PfColors } from '../../components/Pf/PfColors';

type RpsChartTypeProp = {
  label: string;
  dataRps: [string, number][];
  dataErrors: [string, number][];
};

export default class RpsChart extends React.Component<RpsChartTypeProp, {}> {
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

    // NOTE: dataRps and dataErrors are arrays of data value points EXCEPT for the first array item.
    // At index 0 of the array is the data label (dataRps[0] == "RPS" and dataErrors[0] == "Error").
    // This is why we skip the first element in each array.
    let minRps: number = dataRps.length > 1 ? +dataRps[1] : 0;
    let maxRps: number = minRps;
    let errSample: number = dataErrors.length > 1 ? +dataErrors[1] : 0;
    let minPctErr: number = (100 * errSample) / minRps;
    let maxPctErr: number = minPctErr;
    for (let i = 2; i < dataRps.length; ++i) {
      const sample: number = +dataRps[i];
      minRps = sample < minRps ? sample : minRps;
      maxRps = sample > maxRps ? sample : maxRps;
      if (sample !== 0) {
        errSample = dataErrors.length > i ? +dataErrors[i] : 0;
        const errPct = (100 * errSample) / sample;
        if (isNaN(minPctErr) || errPct < minPctErr) {
          minPctErr = errPct;
        }
        if (isNaN(maxPctErr) || errPct > maxPctErr) {
          maxPctErr = errPct;
        }
      }
    }

    return (
      <>
        <div>
          <strong>{this.props.label} min / max:</strong>
        </div>
        <div>
          RPS: {minRps.toFixed(2)} / {maxRps.toFixed(2)} , %Error {minPctErr.toFixed(2)} / {maxPctErr.toFixed(2)}
        </div>
        {this.props.dataRps.length > 0 && (
          <AreaChart
            size={{ height: 45 }}
            color={{ pattern: [PfColors.Blue, PfColors.Red100] }}
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
