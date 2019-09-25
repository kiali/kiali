import * as React from 'react';
import { Chart, ChartBar, ChartStack, ChartAxis } from '@patternfly/react-charts';

import { NamespaceStatus } from './NamespaceInfo';
import { FAILURE, DEGRADED, HEALTHY } from '../../types/Health';

type Props = {
  status: NamespaceStatus;
};

type State = {
  width: number;
};

class OverviewCardBars extends React.Component<Props, State> {
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
    const hiddenAxisStyle = {
      axis: { stroke: 'none' },
      ticks: { stroke: 'none' },
      tickLabels: { stroke: 'none', fill: 'none' }
    };
    return (
      <div ref={this.containerRef}>
        <Chart height={50} width={this.state.width} padding={{ top: 20, left: 5, right: 5, bottom: 0 }}>
          <ChartStack colorScale={[FAILURE.color, DEGRADED.color, HEALTHY.color]} xOffset={10}>
            <ChartBar horizontal={true} barWidth={16} data={[{ y: this.props.status.inError.length }]} />
            <ChartBar horizontal={true} barWidth={16} data={[{ y: this.props.status.inWarning.length }]} />
            <ChartBar horizontal={true} barWidth={16} data={[{ y: this.props.status.inSuccess.length }]} />
          </ChartStack>
          <ChartAxis style={hiddenAxisStyle} />
          <ChartAxis style={hiddenAxisStyle} dependentAxis={true} />
        </Chart>
      </div>
    );
  }
}

export default OverviewCardBars;
