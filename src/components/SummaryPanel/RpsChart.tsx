import * as React from 'react';
import { AreaChart, Icon } from 'patternfly-react';
import { PfColors } from '../../components/Pf/PfColors';
import { style } from 'typestyle';
import { SUMMARY_PANEL_CHART_WIDTH } from '../../types/Graph';

type RpsChartTypeProp = {
  label: string;
  dataRps: [string | number][];
  dataErrors: [string | number][];
  hide?: boolean;
};

type TcpChartTypeProp = {
  label: string;
  sentRates: [string | number][];
  receivedRates: [string | number][];
  hide?: boolean;
};

type BytesAbbreviation = {
  originalValue: number;
  multiplier: number;
  unit: string;
  abbreviatedValue: () => number;
  format: (includeUnit: boolean) => string;
};

const sparklineAxisProps = (): any => {
  return {
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
};

const blockStyle = style({
  marginTop: '0.5em',
  marginBottom: '0.5em'
});

const renderNoTrafficLegend = () => {
  return (
    <div>
      <Icon type="pf" name="info" /> Not enough traffic to generate chart.
    </div>
  );
};

const thereIsTrafficData = seriesData => {
  return (
    seriesData &&
    seriesData.length > 1 &&
    seriesData[0].length > 1 &&
    seriesData[1].slice(1).reduce((accum, val) => accum + Number(val), 0) > 0
  );
};

const renderSparkline = (series: [string | number][], colors: PfColors[], yTickFormat?: (val: number) => string) => {
  const chartData = {
    x: 'x',
    columns: series,
    type: 'area-spline'
  };

  const axisProps = sparklineAxisProps();
  if (yTickFormat) {
    axisProps.y.tick = {
      format: yTickFormat
    };
  }

  return (
    <AreaChart
      size={{ height: 45, width: SUMMARY_PANEL_CHART_WIDTH }}
      color={{ pattern: colors }}
      legend={{ show: false }}
      grid={{ y: { show: false } }}
      axis={axisProps}
      data={chartData}
    />
  );
};

export class RpsChart extends React.Component<RpsChartTypeProp, {}> {
  render() {
    return (
      <>
        {!this.props.hide && (
          <div className={blockStyle}>
            <div>
              <strong>{this.props.label} min / max:</strong>
            </div>
            {thereIsTrafficData(this.props.dataRps) ? this.renderMinMaxStats() : renderNoTrafficLegend()}
            {this.renderSparkline()}
          </div>
        )}
      </>
    );
  }

  private renderMinMaxStats = () => {
    let dataRps: any = [],
      dataErrors: any = [];
    if (this.props.dataRps.length > 0) {
      dataRps = this.props.dataRps[1];
      dataErrors = this.props.dataErrors[1];
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
      <div>
        RPS: {minRps.toFixed(2)} / {maxRps.toFixed(2)} , %Error {minPctErr.toFixed(2)} / {maxPctErr.toFixed(2)}
      </div>
    );
  };

  private renderSparkline = () => {
    if (!thereIsTrafficData(this.props.dataRps)) {
      return null;
    }

    return renderSparkline(this.props.dataRps.concat(this.props.dataErrors), [PfColors.Blue, PfColors.Red]);
  };
}

export class TcpChart extends React.Component<TcpChartTypeProp, {}> {
  render() {
    return (
      <>
        {!this.props.hide && (
          <div className={blockStyle}>
            <div>
              <strong>{this.props.label} - min / max:</strong>
            </div>
            {this.thereIsTrafficData() ? this.renderMinMaxStats() : renderNoTrafficLegend()}
            {this.renderSparkline()}
          </div>
        )}
      </>
    );
  }

  private renderMinMaxStats = () => {
    let dataSent: any = [],
      dataReceived: any = [];
    if (this.props.sentRates.length > 0) {
      // NOTE: props.sentRates and props.receivedRates are arrays of data value points EXCEPT for the first array item.
      // At index 0 of the array is the data label (sentRates[0] == "TCP Sent" and receivedRates[0] == "TCP Received").
      // This is why we skip the first element in each array.
      dataSent = this.props.sentRates[1].slice(1);
      dataReceived = this.props.receivedRates[1].slice(1);
    }

    let minSent: number = 0,
      maxSent: number = 0,
      minReceived: number = 0,
      maxReceived: number = 0;

    if (dataSent.length > 0) {
      minSent = Math.min(...dataSent);
      maxSent = Math.max(...dataSent);
    }
    if (dataReceived.length > 0) {
      minReceived = Math.min(...dataReceived);
      maxReceived = Math.max(...dataReceived);
    }

    return (
      <div>
        <Icon name="square" style={{ color: PfColors.Blue }} /> Sent: {this.formatMinMaxStats(minSent, maxSent)}
        <br />
        <Icon name="square" style={{ color: PfColors.Green }} /> Received:{' '}
        {this.formatMinMaxStats(minReceived, maxReceived)}
      </div>
    );
  };

  private thereIsTrafficData = () => {
    return thereIsTrafficData(this.props.receivedRates) || thereIsTrafficData(this.props.sentRates);
  };

  private renderSparkline = () => {
    if (!this.thereIsTrafficData()) {
      return null;
    }

    return renderSparkline(
      this.props.sentRates.concat(this.props.receivedRates),
      [PfColors.Blue, PfColors.Green],
      val => {
        return this.abbreviateBytes(val).format(true) + '/s';
      }
    );
  };

  private abbreviateBytes = (bytes: number): BytesAbbreviation => {
    const abbreviation: BytesAbbreviation = {
      originalValue: bytes,
      multiplier: 1,
      unit: 'B',
      abbreviatedValue: () => {
        return abbreviation.originalValue / abbreviation.multiplier;
      },
      format: (includeUnit: boolean) => {
        let rVal = abbreviation.abbreviatedValue().toFixed(2);
        if (includeUnit) {
          rVal += ' ' + abbreviation.unit;
        }
        return rVal;
      }
    };

    if (bytes >= 1e9) {
      abbreviation.multiplier = 1e9;
      abbreviation.unit = 'G';
    } else if (bytes >= 1e6) {
      abbreviation.multiplier = 1e6;
      abbreviation.unit = 'M';
    } else if (bytes >= 1e3) {
      abbreviation.multiplier = 1e3;
      abbreviation.unit = 'K';
    }

    return abbreviation;
  };

  private formatMinMaxStats = (min: number, max: number): string => {
    const minAbbr = this.abbreviateBytes(min);
    const maxAbbr = this.abbreviateBytes(max);

    if (minAbbr.multiplier > maxAbbr.multiplier) {
      maxAbbr.unit = minAbbr.unit;
      maxAbbr.multiplier = minAbbr.multiplier;
    } else {
      minAbbr.unit = maxAbbr.unit;
      minAbbr.multiplier = maxAbbr.multiplier;
    }

    return minAbbr.format(false) + ' / ' + maxAbbr.format(true) + '/s';
  };
}
