import * as React from 'react';

import { DurationInSeconds } from '../../types/Common';
import { Metric } from '../../types/Metrics';
import { getName } from '../../utils/RateIntervals';
import { PfColors } from 'components/Pf/PfColors';
import { SparklineChart } from 'components/Charts/SparklineChart';
import { toVCLines } from 'utils/VictoryChartsUtils';

import 'components/Charts/Charts.css';

type Props = {
  metrics?: Metric[];
  duration: DurationInSeconds;
};

class OverviewCardSparkline extends React.Component<Props, {}> {
  render() {
    if (this.props.metrics && this.props.metrics.length > 0) {
      const data = toVCLines(this.props.metrics, 'rps', [PfColors.Blue], 'time');

      return (
        <>
          {'Traffic, ' + getName(this.props.duration).toLowerCase()}
          <SparklineChart
            name={'traffic'}
            height={60}
            showLegend={false}
            padding={{ top: 5 }}
            tooltipFormat={dp => `${(dp.x as Date).toLocaleTimeString()}\n${dp.y} RPS`}
            series={data}
          />
        </>
      );
    }
    return <div style={{ paddingTop: '40px' }}>No traffic</div>;
  }
}

export default OverviewCardSparkline;
