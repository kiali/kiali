import * as React from 'react';
import { DonutChart } from 'patternfly-react';
import Health from '../../types/Health';

interface Props {
  health?: Health;
  size: number;
  thickness?: number;
}

class ServiceHealth extends React.Component<Props, {}> {
  static DonutColors = {
    // From Patternfly status palette
    Healthy: '#3f9c35',
    Failure: '#cc0000',
    'N/A': '#707070'
  };

  donutData: any;
  donutSize: any;
  donutTitle: string;

  constructor(props: Props) {
    super(props);
    this.onGetProps(props);
  }

  componentWillReceiveProps(nextProps: Props) {
    this.onGetProps(nextProps);
  }

  onGetProps(props: Props) {
    this.donutSize = {
      width: props.size,
      height: props.size
    };
    let columns: [string, number][] = [];
    if (props.health && props.health.totalReplicas > 0) {
      columns = [
        ['N/A', 0],
        ['Healthy', props.health.healthyReplicas],
        ['Failure', props.health.totalReplicas - props.health.healthyReplicas]
      ];
      this.donutTitle = Math.round(100 * props.health.healthyReplicas / props.health.totalReplicas) + '%';
    } else {
      columns = [['N/A', 1], ['Healthy', 0], ['Failure', 0]];
      this.donutTitle = 'n/a';
    }
    this.donutData = {
      colors: ServiceHealth.DonutColors,
      columns: columns,
      type: 'donut'
    };
  }

  render() {
    if (this.props.health) {
      return (
        <DonutChart
          id={'health-donut'}
          size={this.donutSize}
          data={this.donutData}
          title={{ type: '', primary: this.donutTitle, secondary: ' ' }}
          legend={{ show: false }}
          donut={this.props.thickness ? { width: this.props.thickness } : {}}
        />
      );
    }
    return <div />;
  }
}

export default ServiceHealth;
