import * as React from 'react';
import { DonutChart } from 'patternfly-react';
import Health from '../../types/Health';

interface Props {
  health?: Health;
  size: number;
  thickness?: number;
  showTitle?: boolean;
}

const KEY_HEALTHY = 'Healthy';
const KEY_FAILURE = 'Failure';
const KEY_NA = 'N/A';
const DONUT_COLORS: { [key: string]: string } = {};
// From Patternfly status palette
DONUT_COLORS[KEY_HEALTHY] = '#3f9c35';
DONUT_COLORS[KEY_FAILURE] = '#cc0000';
DONUT_COLORS[KEY_NA] = '#707070';

class ServiceHealth extends React.Component<Props, {}> {
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
        [KEY_NA, 0],
        [KEY_HEALTHY, props.health.healthyReplicas],
        [KEY_FAILURE, props.health.totalReplicas - props.health.healthyReplicas]
      ];
      this.donutTitle = Math.round(100 * props.health.healthyReplicas / props.health.totalReplicas) + '%';
    } else {
      columns = [[KEY_NA, 1], [KEY_HEALTHY, 0], [KEY_FAILURE, 0]];
      this.donutTitle = 'n/a';
    }
    if (props.showTitle !== undefined && !props.showTitle) {
      this.donutTitle = ' ';
    }
    this.donutData = {
      colors: DONUT_COLORS,
      columns: columns,
      type: 'donut'
    };
  }

  render() {
    if (this.props.health) {
      return (
        <DonutChart
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
