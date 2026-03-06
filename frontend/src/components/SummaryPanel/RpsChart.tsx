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
  dataErrors: Datapoint[];
  dataRps: Datapoint[];
  hide?: boolean;
  label: string;
};

type StreamChartProp = {
  hide?: boolean;
  label: string;
  receivedRates: Datapoint[];
  sentRates: Datapoint[];
  unit: 'bytes' | 'messages';
};

type BytesAbbreviation = {
  abbreviatedValue: () => number;
  format: (includeUnit: boolean) => string;
  multiplier: number;
  originalValue: number;
  unit: string;
};

const blockStyle = kialiStyle({
  marginBottom: '0.5em',
  marginTop: '0.5em'
});

const renderNoTrafficLegend = (): JSX.Element => {
  return (
    <div>
      <InfoAltIcon /> Not enough traffic to generate chart.
    </div>
  );
};

const thereIsTrafficData = (seriesData: VCLine<RichDataPoint>): boolean => {
  return seriesData.datapoints.reduce((accum, val) => accum + val.y, 0) > 0;
};

const renderSparklines = (series: VCLines<RichDataPoint>, yTickFormat?: (val: number) => string): JSX.Element => {
  const yFormat = yTickFormat ? yTickFormat : (y: number): string => `${y.toFixed(2)} rps`;
  return (
    <SparklineChart
      height={41}
      labelName="ops"
      name="rps"
      padding={{ top: 5 }}
      series={series}
      showLegend={false}
      tooltipFormat={(dp): string => `${(dp.x as Date).toLocaleStringWithConditionalDate()}\n${yFormat(dp.y)}`}
      width={SUMMARY_PANEL_CHART_WIDTH}
    />
  );
};

export class RequestChart extends React.Component<RequestChartProp, {}> {
  render(): React.ReactNode {
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

  private renderContent = (): JSX.Element => {
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

  private renderMinMaxStats = (dataRps: VCDataPoint[], dataErrors: VCDataPoint[]): JSX.Element => {
    let minRps = dataRps.length > 0 ? dataRps[0].y : 0;
    let maxRps = minRps;
    let errSample = dataErrors.length > 0 ? dataErrors[0].y : 0;
    let minPctErr = Number.NaN;
    let maxPctErr = Number.NaN;
    if (minRps > 0) {
      minPctErr = (100 * errSample) / minRps;
      maxPctErr = minPctErr;
    }
    for (let i = 1; i < dataRps.length; ++i) {
      const sample = dataRps[i].y;
      minRps = sample < minRps ? sample : minRps;
      maxRps = sample > maxRps ? sample : maxRps;
      if (sample > 0) {
        errSample = i < dataErrors.length ? dataErrors[i].y : 0;
        const errPct = (100 * errSample) / sample;
        if (Number.isNaN(minPctErr) || errPct < minPctErr) {
          minPctErr = errPct;
        }
        if (Number.isNaN(maxPctErr) || errPct > maxPctErr) {
          maxPctErr = errPct;
        }
      }
    }

    const fmtPct = (p: number): string => (Number.isFinite(p) ? p.toFixed(2) : 'N/A');

    return (
      <div>
        RPS: {minRps.toFixed(2)} / {maxRps.toFixed(2)} , % Error {fmtPct(minPctErr)} / {fmtPct(maxPctErr)}
      </div>
    );
  };
}

export class StreamChart extends React.Component<StreamChartProp, {}> {
  render(): React.ReactNode {
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

  private renderContent = (): JSX.Element => {
    const sentLine = toVCLine(this.props.sentRates, 'Sent', PFColors.Blue400);
    const receivedLine = toVCLine(this.props.receivedRates, 'Received', PFColors.Green400);
    if (thereIsTrafficData(sentLine) || thereIsTrafficData(receivedLine)) {
      return (
        <>
          {this.renderMinMaxStats(
            sentLine.datapoints.map(dp => dp.y),
            receivedLine.datapoints.map(dp => dp.y)
          )}
          {renderSparklines([sentLine, receivedLine], (val: number): string => {
            return this.props.unit === 'bytes'
              ? `${this.abbreviateBytes(val).format(true)}/s`
              : `${val.toFixed(2)} msg/s`;
          })}
        </>
      );
    } else {
      return renderNoTrafficLegend();
    }
  };

  private renderMinMaxStats = (dataSent: number[], dataReceived: number[]): JSX.Element => {
    const safeMin = (arr: number[]): number =>
      arr.length === 0 ? NaN : arr.reduce((a, b) => (Number.isFinite(b) && b < a ? b : a), Infinity);
    const safeMax = (arr: number[]): number =>
      arr.length === 0 ? NaN : arr.reduce((a, b) => (Number.isFinite(b) && b > a ? b : a), -Infinity);

    const minSent = safeMin(dataSent);
    const maxSent = safeMax(dataSent);
    const minReceived = safeMin(dataReceived);
    const maxReceived = safeMax(dataReceived);

    const fmtVal = (minV: number, maxV: number): string =>
      Number.isFinite(minV) && Number.isFinite(maxV) ? this.formatMinMaxStats(minV, maxV) : 'N/A';

    return (
      <div>
        <SquareFullIcon style={{ color: PFColors.Blue400 }} /> Sent: {fmtVal(minSent, maxSent)}
        <br />
        <SquareFullIcon style={{ color: PFColors.Green400 }} /> Received: {fmtVal(minReceived, maxReceived)}
      </div>
    );
  };

  private abbreviateBytes = (bytes: number): BytesAbbreviation => {
    if (!Number.isFinite(bytes)) {
      bytes = 0;
    }
    const abbreviation: BytesAbbreviation = {
      abbreviatedValue: () => {
        return abbreviation.originalValue / abbreviation.multiplier;
      },
      format: (includeUnit: boolean) => {
        let rVal = abbreviation.abbreviatedValue().toFixed(2);
        if (includeUnit) {
          rVal = `${rVal} ${abbreviation.unit}`;
        }
        return rVal;
      },
      multiplier: 1,
      originalValue: bytes,
      unit: 'B'
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

      return `${minAbbr.format(false)} / ${maxAbbr.format(true)}/s`;
    }

    return `${min.toFixed(2)} / ${max.toFixed(2)} msg/s`;
  };
}
