import * as React from 'react';
import { Text, TextVariants } from '@patternfly/react-core';

import { DEGRADED, FAILURE, HEALTHY, IDLE } from '../../types/Health';
import OverviewStatus from './OverviewStatus';
import { OverviewType } from './OverviewToolbar';
import { NamespaceStatus } from './NamespaceInfo';
import { switchType } from './OverviewHelper';
import { Paths } from '../../config';

type Props = {
  name: string;
  type: OverviewType;
  status: NamespaceStatus;
};

class OverviewCardContentCompact extends React.Component<Props> {
  render() {
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
    return (
      <>
        <div style={{ textAlign: 'left' }}>
          <span>
            <div style={{ display: 'inline-block', width: '125px' }}>{text}</div>
            <div style={{ display: 'inline-block' }}>
              <Text component={TextVariants.h3}>
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
                {nbItems === status.notAvailable.length && (
                  <div style={{ display: 'inline-block', marginLeft: '5px' }}>
                    <Text>N/A</Text>
                  </div>
                )}
              </Text>
            </div>
          </span>
        </div>
      </>
    );
  }
}

export default OverviewCardContentCompact;
