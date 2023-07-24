import * as React from 'react';
import { InfoAltIcon } from '@patternfly/react-icons';
import { SUMMARY_PANEL_CHART_WIDTH } from '../../types/Graph';
import { Datapoint } from '../../types/Metrics';
import { PFColors } from 'components/Pf/PfColors';
import { toVCLine } from 'utils/VictoryChartsUtils';
import { SparklineChart } from 'components/Charts/SparklineChart';
import { summaryTitle } from 'pages/Graph/SummaryPanelCommon';

export type ResponseTimeUnit = 's' | 'ms';
type ResponseTimeChartTypeProp = {
  hide?: boolean;
  label: string;
  rtAvg: Datapoint[];
  rtMed: Datapoint[];
  rt95: Datapoint[];
  rt99: Datapoint[];
  unit: ResponseTimeUnit;
};

export class ResponseTimeChart extends React.Component<ResponseTimeChartTypeProp, {}> {
  thereIsTrafficData = () => {
    return this.props.rtAvg.length > 0;
  };

  // The prom data may be in seconds but we want to report response times in millis when the user hovers
  // Convert the data points to millis.
  toMillis = (dps: Datapoint[]): Datapoint[] => {
    return dps.map(dp => [dp[0], dp[1] * 1000.0]);
  };

  render() {
    const scaler = this.props.unit === 's' ? this.toMillis : a => a;
    const series = [
      toVCLine(scaler(this.props.rtAvg), 'avg', PFColors.Black1000),
      toVCLine(scaler(this.props.rtMed), 'p50', PFColors.Green400),
      toVCLine(scaler(this.props.rt95), 'p95', PFColors.Blue400),
      toVCLine(scaler(this.props.rt99), 'p99', PFColors.Orange400)
    ];

    return (
      <>
        {!this.props.hide && (
          <div>
            <div className={summaryTitle}>{this.props.label}</div>{' '}
            {this.thereIsTrafficData() ? (
              <SparklineChart
                name={'rt'}
                height={70}
                width={SUMMARY_PANEL_CHART_WIDTH}
                showLegend={true}
                padding={{ top: 5 }}
                tooltipFormat={dp => {
                  const val = Math.floor(dp.y * 1000) / 1000;
                  return `${(dp.x as Date).toLocaleStringWithConditionalDate()} - ${dp.name}: ${val.toFixed(2)} ms`;
                }}
                series={series}
                labelName="ops"
              />
            ) : (
              <div>
                <InfoAltIcon /> Not enough traffic to generate chart.
              </div>
            )}
          </div>
        )}
      </>
    );
  }
}
