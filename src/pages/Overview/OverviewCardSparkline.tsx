import * as React from 'react';
import { SparklineChart } from '@kiali/k-charted-pf4';
import { ChartThemeColor } from '@patternfly/react-charts';

import { DurationInSeconds } from '../../types/Common';
import { TimeSeries } from '../../types/Metrics';
import graphUtils from '../../utils/Graphing';
import { getName } from '../../utils/RateIntervals';
import { PfColors } from 'components/Pf/PfColors';

import 'components/Charts/Charts.css';

type Props = {
  metrics?: TimeSeries[];
  duration: DurationInSeconds;
};

class OverviewCardSparkline extends React.Component<Props, {}> {
  render() {
    if (this.props.metrics && this.props.metrics.length > 0) {
      const data = graphUtils.toVCLines(this.props.metrics, [PfColors.Blue]);

      return (
        <>
          {'Traffic, ' + getName(this.props.duration).toLowerCase()}
          <SparklineChart
            name={'traffic'}
            height={60}
            showLegend={false}
            padding={{ top: 5 }}
            themeColor={ChartThemeColor.multi}
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
