import * as React from 'react';
import { Chart, ChartProps, ChartTooltip, ChartVoronoiContainer } from '@patternfly/react-charts';
import { VCDataPoint } from '../utils/Graphing';

export const createContainer = (formatter: (dp: VCDataPoint) => string) => {
  const tooltip = (
    <ChartTooltip
      style={{ stroke: 'none' }}
      flyoutStyle={{ fillOpacity: 0.8 }}
      renderInPortal={true}
      constrainToVisibleArea={true}
    />
  );
  return (
    <ChartVoronoiContainer
      voronoiDimension={'x'}
      labels={obj => formatter(obj.datum)}
      labelComponent={tooltip}
      // We blacklist "parent" as a workaround to avoid the VictoryVoronoiContainer crashing.
      // See https://github.com/FormidableLabs/victory/issues/1355
      voronoiBlacklist={['parent']}
    />
  );
};

type Props = ChartProps & {
  formatter: (dp: VCDataPoint) => string;
};

type State = {
  width: number;
};

export class AutoSizedChart extends React.Component<Props, State> {
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
    return (
      <div ref={this.containerRef}>
        <Chart width={this.state.width} containerComponent={createContainer(this.props.formatter)} {...this.props}>
          {this.props.children}
        </Chart>
      </div>
    );
  }
}
