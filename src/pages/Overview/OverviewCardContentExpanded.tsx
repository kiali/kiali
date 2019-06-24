import * as React from 'react';
import {
  AggregateStatusNotification,
  AggregateStatusNotifications,
  StackedBarChart,
  SparklineChart
} from 'patternfly-react';
import { Link } from 'react-router-dom';
import { DEGRADED, FAILURE, HEALTHY } from '../../types/Health';
import OverviewStatus from './OverviewStatus';
import { OverviewType } from './OverviewToolbar';
import { NamespaceStatus } from './NamespaceInfo';
import { switchType } from './OverviewHelper';
import { Paths } from '../../config';
import { TimeSeries } from '../../types/Metrics';
import graphUtils from '../../utils/Graphing';
import { DurationInSeconds } from '../../types/Common';
import { getName } from '../../utils/RateIntervals';

type Props = {
  name: string;
  type: OverviewType;
  duration: DurationInSeconds;
  status: NamespaceStatus;
  metrics?: TimeSeries[];
};

class OverviewCardContentExpanded extends React.Component<Props> {
  render() {
    return (
      <>
        <div style={{ width: '50%', display: 'inline-block', height: 90 }}>{this.renderLeft()}</div>
        <div
          style={{
            width: '50%',
            display: 'inline-block',
            height: 90,
            borderLeft: '1px solid #d1d1d1',
            paddingLeft: 10,
            verticalAlign: 'top'
          }}
        >
          {this.renderRight()}
        </div>
      </>
    );
  }

  renderLeft(): JSX.Element {
    const targetPage = switchType(this.props.type, Paths.APPLICATIONS, Paths.SERVICES, Paths.WORKLOADS);
    const name = this.props.name;
    const status = this.props.status;
    const nbItems =
      status.inError.length + status.inWarning.length + status.inSuccess.length + status.notAvailable.length;
    let text: string;
    if (nbItems === 1) {
      text = switchType(this.props.type, '1 Application', '1 Service', '1 Workload');
    } else {
      text = nbItems + switchType(this.props.type, ' Applications', ' Services', ' Workloads');
    }
    const mainLink = <Link to={`/${targetPage}?namespaces=${name}`}>{text}</Link>;
    if (nbItems === status.notAvailable.length) {
      return (
        <>
          {mainLink}
          <AggregateStatusNotifications>
            <AggregateStatusNotification>N/A</AggregateStatusNotification>
          </AggregateStatusNotifications>
        </>
      );
    }
    return (
      <>
        {mainLink}
        <StackedBarChart
          style={{ paddingLeft: 13 }}
          id={'card-barchart-' + name}
          size={{ height: 50 }}
          axis={{ rotated: true, x: { show: false, categories: ['Health'], type: 'category' }, y: { show: false } }}
          grid={{ x: { show: false }, y: { show: false } }}
          tooltip={{ show: false }}
          data={{
            groups: [[FAILURE.name, DEGRADED.name, HEALTHY.name]],
            columns: [
              [FAILURE.name, status.inError.length],
              [DEGRADED.name, status.inWarning.length],
              [HEALTHY.name, status.inSuccess.length]
            ],
            order: null,
            type: 'bar'
          }}
          color={{ pattern: [FAILURE.color, DEGRADED.color, HEALTHY.color] }}
          bar={{ width: 20 }}
          legend={{ hide: true }}
        />
        <AggregateStatusNotifications style={{ marginTop: -20, position: 'relative' }}>
          {status.inError.length > 0 && (
            <OverviewStatus
              id={name + '-failure'}
              namespace={name}
              status={FAILURE}
              items={status.inError}
              targetPage={targetPage}
            />
          )}
          {status.inWarning.length > 0 && (
            <OverviewStatus
              id={name + '-degraded'}
              namespace={name}
              status={DEGRADED}
              items={status.inWarning}
              targetPage={targetPage}
            />
          )}
          {status.inSuccess.length > 0 && (
            <OverviewStatus
              id={name + '-healthy'}
              namespace={name}
              status={HEALTHY}
              items={status.inSuccess}
              targetPage={targetPage}
            />
          )}
        </AggregateStatusNotifications>
      </>
    );
  }

  renderRight(): JSX.Element {
    if (this.props.metrics && this.props.metrics.length > 0) {
      return (
        <>
          {'Traffic, ' + getName(this.props.duration).toLowerCase()}
          <SparklineChart
            id={'card-sparkline-' + this.props.name}
            data={{ x: 'x', columns: graphUtils.toC3Columns(this.props.metrics, 'RPS'), type: 'area' }}
            tooltip={{}}
            axis={{
              x: { show: false, type: 'timeseries', tick: { format: '%H:%M:%S' } },
              y: { show: false }
            }}
          />
        </>
      );
    }
    return <div style={{ marginTop: 20 }}>No traffic</div>;
  }
}

export default OverviewCardContentExpanded;
