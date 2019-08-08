import * as React from 'react';
import { Chart, ChartArea, ChartThemeColor, ChartAxis } from '@patternfly/react-charts';

import { DurationInSeconds } from '../../types/Common';
import { TimeSeries } from '../../types/Metrics';
import graphUtils from '../../utils/Graphing';
import { getName } from '../../utils/RateIntervals';

type Props = {
  metrics?: TimeSeries[];
  duration: DurationInSeconds;
};

type State = {
  width: number;
};

class OverviewCardSparkline extends React.Component<Props, State> {
  containerRef = React.createRef<HTMLDivElement>();

  constructor(props: Props) {
    super(props);
    this.state = { width: 0 };
  }

  handleResize = () => {
    if (this.containerRef.current) {
      this.setState({ width: this.containerRef.current.clientWidth });
    }
  };

  componentDidMount() {
    setTimeout(() => {
      this.handleResize();
      window.addEventListener('resize', this.handleResize);
    });
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
  }

  render() {
    if (this.props.metrics && this.props.metrics.length > 0) {
      const data = graphUtils.toVCLines(this.props.metrics);

      return (
        <div ref={this.containerRef}>
          {'Traffic, ' + getName(this.props.duration).toLowerCase()}
          <div className="area-chart-overflow">
            <Chart
              height={60}
              width={this.state.width}
              padding={0}
              themeColor={ChartThemeColor.multi}
              scale={{ x: 'time' }}
            >
              {data.series.map((serie, idx) => (
                <ChartArea key={'serie-' + idx} data={serie} />
              ))}
              <ChartAxis tickCount={5} tickFormat={() => ''} />
              <ChartAxis dependentAxis={true} tickFormat={() => ''} />
            </Chart>
          </div>
        </div>
      );
    }
    return <div style={{ marginTop: 20 }}>No traffic</div>;
  }
}

export default OverviewCardSparkline;
