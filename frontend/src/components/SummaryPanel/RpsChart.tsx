import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { InfoAltIcon, SquareFullIcon } from '@patternfly/react-icons';
import { SparklineChart } from 'components/Charts/SparklineChart';
import { PFColors } from '../Pf/PfColors';
import { SUMMARY_PANEL_CHART_WIDTH } from '../../types/Graph';
import { Datapoint } from '../../types/Metrics';
import { toVCLine } from 'utils/VictoryChartsUtils';
import { RichDataPoint, VCDataPoint, VCLine, VCLines } from 'types/VictoryChartInfo';
import { summaryTitle } from 'pages/Graph/SummaryPanelCommon';

type RequestChartProp = {
  label: string;
  dataRps: Datapoint[];
  dataErrors: Datapoint[];
  hide?: boolean;
};

type StreamChartProp = {
  hide?: boolean;
  label: string;
  receivedRates: Datapoint[];
  sentRates: Datapoint[];
  unit: 'bytes' | 'messages';
};

type BytesAbbreviation = {
  originalValue: number;
  multiplier: number;
  unit: string;
  abbreviatedValue: () => number;
  format: (includeUnit: boolean) => string;
};

const blockStyle = kialiStyle({
  marginTop: '0.5em',
  marginBottom: '0.5em'
});

const renderNoTrafficLegend = () => {
  return (
    <div>
      <InfoAltIcon /> Not enough traffic to generate chart.
    </div>
  );
};

const thereIsTrafficData = (seriesData: VCLine<RichDataPoint>) => {
  return seriesData.datapoints.reduce((accum, val) => accum + val.y, 0) > 0;
};

const renderSparklines = (series: VCLines<RichDataPoint>, yTickFormat?: (val: number) => string) => {
  const yFormat = yTickFormat ? yTickFormat : y => `${y.toFixed(2)} rps`;
  return (
    <SparklineChart
      name="rps"
      height={41}
      width={SUMMARY_PANEL_CHART_WIDTH}
      showLegend={false}
      padding={{ top: 5 }}
      tooltipFormat={dp => `${(dp.x as Date).toLocaleStringWithConditionalDate()}\n${yFormat(dp.y)}`}
      series={series}
      labelName="ops"
    />
  );
};

export class RequestChart extends React.Component<RequestChartProp, {}> {
  render() {
    return (
      <>
        {!this.props.hide && (
          <div className={blockStyle}>
            <div className={summaryTitle}>{this.props.label} min / max:</div>
            {this.renderContent()}
          </div>
        )}
      </>
    );
  }

  private renderContent = () => {
    const rpsLine = toVCLine(this.props.dataRps, 'RPS', PFColors.Info);
    const errLine = toVCLine(this.props.dataErrors, 'Error', PFColors.Danger);
    if (thereIsTrafficData(rpsLine)) {
      return (
        <>
          {this.renderMinMaxStats(rpsLine.datapoints, errLine.datapoints)}
          {renderSparklines([rpsLine, errLine])}
        </>
      );
    } else {
      return renderNoTrafficLegend();
    }
  };

  private renderMinMaxStats = (dataRps: VCDataPoint[], dataErrors: VCDataPoint[]) => {
    let minRps = dataRps.length > 0 ? dataRps[0].y : 0;
    let maxRps = minRps;
    let errSample = dataErrors.length > 0 ? dataErrors[0].y : 0;
    let minPctErr = (100 * errSample) / minRps;
    let maxPctErr = minPctErr;
    for (let i = 1; i < dataRps.length; ++i) {
      const sample = dataRps[i].y;
      minRps = sample < minRps ? sample : minRps;
      maxRps = sample > maxRps ? sample : maxRps;
      if (sample !== 0) {
        errSample = i < dataErrors.length ? dataErrors[i].y : 0;
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
        RPS: {minRps.toFixed(2)} / {maxRps.toFixed(2)} , % Error {minPctErr.toFixed(2)} / {maxPctErr.toFixed(2)}
      </div>
    );
  };
}

export class StreamChart extends React.Component<StreamChartProp, {}> {
  render() {
    return (
      <>
        {!this.props.hide && (
          <div className={blockStyle}>
            <div className={summaryTitle}>{this.props.label} min / max:</div>
            {this.renderContent()}
          </div>
        )}
      </>
    );
  }

  private renderContent = () => {
    const sentLine = toVCLine(this.props.sentRates, 'Sent', PFColors.Blue400);
    const receivedLine = toVCLine(this.props.receivedRates, 'Received', PFColors.Green400);
    if (thereIsTrafficData(sentLine) || thereIsTrafficData(receivedLine)) {
      return (
        <>
          {this.renderMinMaxStats(
            sentLine.datapoints.map(dp => dp.y),
            receivedLine.datapoints.map(dp => dp.y)
          )}
          {renderSparklines([sentLine, receivedLine], val => {
            return this.props.unit === 'bytes'
              ? this.abbreviateBytes(val).format(true) + '/s'
              : `${val.toFixed(2)} msg/s`;
          })}
        </>
      );
    } else {
      return renderNoTrafficLegend();
    }
  };

  private renderMinMaxStats = (dataSent: number[], dataReceived: number[]) => {
    let minSent = 0,
      maxSent = 0,
      minReceived = 0,
      maxReceived = 0;

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
        <SquareFullIcon style={{ color: PFColors.Blue400 }} /> Sent: {this.formatMinMaxStats(minSent, maxSent)}
        <br />
        <SquareFullIcon style={{ color: PFColors.Green400 }} /> Received:{' '}
        {this.formatMinMaxStats(minReceived, maxReceived)}
      </div>
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
    if (this.props.unit === 'bytes') {
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
    }

    return min.toFixed(2) + ' / ' + max.toFixed(2) + ' msg/s';
  };
}
