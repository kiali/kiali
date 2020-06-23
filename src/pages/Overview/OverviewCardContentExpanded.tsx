import * as React from 'react';
import { Text, TextVariants } from '@patternfly/react-core';

import { DEGRADED, FAILURE, HEALTHY, IDLE } from '../../types/Health';
import OverviewStatus from './OverviewStatus';
import { OverviewType } from './OverviewToolbar';
import { NamespaceStatus } from './NamespaceInfo';
import { switchType } from './OverviewHelper';
import { Paths } from '../../config';
import { TimeSeries } from '../../types/Metrics';
import { DurationInSeconds } from '../../types/Common';
import OverviewCardSparkline from './OverviewCardSparkline';

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
        <>{this.renderStatus()}</>
        <div
          style={{
            width: '100%',
            height: 90,
            verticalAlign: 'top'
          }}
        >
          <OverviewCardSparkline metrics={this.props.metrics} duration={this.props.duration} />
        </div>
      </>
    );
  }

  renderStatus(): JSX.Element {
    const targetPage = switchType(this.props.type, Paths.APPLICATIONS, Paths.SERVICES, Paths.WORKLOADS);
    const name = this.props.name;
    const status = this.props.status;
    const nbItems =
      status.inError.length +
      status.inWarning.length +
      status.inSuccess.length +
      status.notAvailable.length +
      status.inIdle.length;
    let text: string;
    if (nbItems === 1) {
      text = switchType(this.props.type, '1 Application', '1 Service', '1 Workload');
    } else {
      text = nbItems + switchType(this.props.type, ' Applications', ' Services', ' Workloads');
    }
    const mainLink = <div style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}>{text}</div>;
    if (nbItems === status.notAvailable.length) {
      return (
        <div style={{ textAlign: 'left' }}>
          <span>
            {mainLink}
            <div style={{ display: 'inline-block', marginLeft: '5px' }}>
              <Text>N/A</Text>
            </div>
          </span>
        </div>
      );
    }
    return (
      <>
        <div style={{ textAlign: 'left' }}>
          <span>
            {mainLink}
            <div style={{ display: 'inline-block' }}>
              <Text component={TextVariants.h2}>
                {status.inIdle.length > 0 && (
                  <OverviewStatus
                    id={name + '-iddle'}
                    namespace={name}
                    status={IDLE}
                    items={status.inIdle}
                    targetPage={targetPage}
                  />
                )}
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
              </Text>
            </div>
          </span>
        </div>
      </>
    );
  }
}

export default OverviewCardContentExpanded;
