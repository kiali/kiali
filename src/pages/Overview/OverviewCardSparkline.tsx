import * as React from 'react';
import {
  Chart,
  ChartArea,
  ChartThemeColor,
  ChartAxis,
  ChartTooltip,
  ChartVoronoiContainer
} from '@patternfly/react-charts';

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

const createContainer = () => {
  const props = {
    constrainToVisibleArea: true
  };
  const tooltip = <ChartTooltip style={{ stroke: 'none', fill: 'white' }} renderInPortal={true} {...props} />;
  return (
    <ChartVoronoiContainer
      labels={obj => `${obj.datum.x.toLocaleTimeString()}\n${obj.datum.y} RPS`}
      labelComponent={tooltip}
      // We blacklist "parent" as a workaround to avoid the VictoryVoronoiContainer crashing.
      // See https://github.com/FormidableLabs/victory/issues/1355
      voronoiBlacklist={['parent']}
    />
  );
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
              containerComponent={createContainer()}
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
