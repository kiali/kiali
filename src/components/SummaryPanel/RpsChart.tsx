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

    let len = dataRps.length;
    let minRps: number = len > 1 ? +dataRps[1] : 0;
    let maxRps: number = len > 1 ? +dataRps[1] : 0;
    let sumRps: number = 0;
    for (let i = 2; i < len; ++i) {
      let sample: number = +dataRps[i];
      minRps = sample < minRps ? sample : minRps;
      maxRps = sample > maxRps ? sample : maxRps;
      sumRps += +sample;
    }
    const avgRps = len < 2 ? 0 : sumRps / (len - 1);

    len = dataErrors.length;
    let minErr: number = len > 1 ? +dataErrors[1] : 0;
    let maxErr: number = len > 1 ? +dataErrors[1] : 0;
    for (let i = 2; i < len; ++i) {
      let sample: number = +dataErrors[i];
      minErr = sample < minErr ? sample : minErr;
      maxErr = sample > maxErr ? sample : maxErr;
    }
    const pctMinErr = avgRps === 0 ? 0 : minErr / avgRps * 100;
    const pctMaxErr = avgRps === 0 ? 0 : maxErr / avgRps * 100;

    return (
      <>
        <div>
          <strong>{this.props.label} min / max:</strong>
        </div>
        <div>
          RPS: {minRps.toFixed(2)} / {maxRps.toFixed(2)} , %Error {pctMinErr.toFixed(2)} / {pctMaxErr.toFixed(2)}
        </div>
        {this.props.dataRps.length > 0 && (
          <AreaChart
            size={{ height: 45 }}
            color={{ pattern: [PfColors.Blue, PfColors.Red] }}
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
