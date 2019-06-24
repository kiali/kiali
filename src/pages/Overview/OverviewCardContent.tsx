import * as React from 'react';
import { AggregateStatusNotification, AggregateStatusNotifications } from 'patternfly-react';
import { Link } from 'react-router-dom';
import { DEGRADED, FAILURE, HEALTHY } from '../../types/Health';
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

class OverviewCardContent extends React.Component<Props> {
  render() {
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
    return (
      <>
        <Link to={`/${targetPage}?namespaces=${name}`}>{text}</Link>
        <AggregateStatusNotifications>
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
          {nbItems === status.notAvailable.length && <AggregateStatusNotification>N/A</AggregateStatusNotification>}
        </AggregateStatusNotifications>
      </>
    );
  }
}

export default OverviewCardContent;
