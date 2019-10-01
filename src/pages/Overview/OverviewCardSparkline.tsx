import * as React from 'react';
import { ChartArea, ChartThemeColor, ChartAxis } from '@patternfly/react-charts';

import { DurationInSeconds } from '../../types/Common';
import { TimeSeries } from '../../types/Metrics';
import graphUtils from '../../utils/Graphing';
import { getName } from '../../utils/RateIntervals';
import { AutoSizedChart } from 'components/Charts';

type Props = {
  metrics?: TimeSeries[];
  duration: DurationInSeconds;
};

class OverviewCardSparkline extends React.Component<Props, {}> {
  render() {
    if (this.props.metrics && this.props.metrics.length > 0) {
      const data = graphUtils.toVCLines(this.props.metrics);

      return (
        <>
          {'Traffic, ' + getName(this.props.duration).toLowerCase()}
          <div className="area-chart-overflow">
            <AutoSizedChart
              height={60}
              padding={{ top: 5 }}
              themeColor={ChartThemeColor.multi}
              scale={{ x: 'time' }}
              formatter={dp => `${(dp.x as Date).toLocaleTimeString()}\n${dp.y} RPS`}
            >
              {data.map((serie, idx) => (
                <ChartArea key={'serie-' + idx} data={serie.datapoints} />
              ))}
              <ChartAxis tickCount={5} tickFormat={() => ''} />
              <ChartAxis dependentAxis={true} tickFormat={() => ''} />
            </AutoSizedChart>
          </div>
        </>
      );
    }
    return <div style={{ marginTop: 20 }}>No traffic</div>;
  }
}

export default OverviewCardSparkline;
