import * as React from 'react';

import { DurationInSeconds } from '../../types/Common';
import { Metric } from '../../types/Metrics';
import { getName } from '../../utils/RateIntervals';
import { PFColors } from 'components/Pf/PfColors';
import { SparklineChart } from 'components/Charts/SparklineChart';
import { toVCLine } from 'utils/VictoryChartsUtils';

import 'components/Charts/Charts.css';
import { RichDataPoint, VCLine } from 'types/VictoryChartInfo';

type Props = {
  metrics?: Metric[];
  errorMetrics?: Metric[];
  duration: DurationInSeconds;
};

function showMetrics(metrics: Metric[] | undefined): boolean {
  // show metrics if metrics exists and some values at least are not zero
  if (metrics && metrics.length > 0 && metrics[0].datapoints.some(dp => Number(dp[1]) !== 0)) {
    return true;
  }

  return false;
}

class OverviewCardSparkline extends React.Component<Props, {}> {
  render() {
    if (showMetrics(this.props.metrics)) {
      let series: VCLine<RichDataPoint>[] = [];

      if (this.props.metrics && this.props.metrics.length > 0) {
        const data = toVCLine(this.props.metrics[0].datapoints, 'Total', PFColors.Blue400);
        series.push(data);
      }

      if (this.props.errorMetrics && this.props.errorMetrics.length > 0) {
        const dataErrors = toVCLine(this.props.errorMetrics[0].datapoints, '4xx+5xx', PFColors.Danger);
        series.push(dataErrors);
      }

      return (
        <>
          <span data-test={'sparkline-duration-' + getName(this.props.duration).toLowerCase()}>{'Inbound traffic, ' + getName(this.props.duration).toLowerCase()}</span>
          <SparklineChart
            name={'traffic'}
            height={60}
            showLegend={false}
            showYAxis={true}
            padding={{ top: 5, left: 30 }}
            tooltipFormat={dp => `${(dp.x as Date).toLocaleTimeString()}\n${dp.y} ${dp.name}`}
            series={series}
          />
        </>
      );
    }
    return <div style={{ paddingTop: '40px' }}>No inbound traffic</div>;
  }
}

export default OverviewCardSparkline;
