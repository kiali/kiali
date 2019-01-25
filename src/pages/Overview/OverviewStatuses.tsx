import * as React from 'react';
import { AggregateStatusNotification, AggregateStatusNotifications } from 'patternfly-react';

import { DEGRADED, FAILURE, HEALTHY } from '../../types/Health';

import OverviewStatus from './OverviewStatus';
import { OverviewType } from './OverviewToolbar';
import { NamespaceStatus } from './NamespaceInfo';
import { ListPageLink, TargetPage } from '../../components/ListPage/ListPageLink';
import { switchType } from './OverviewHelper';

type Props = {
  name: string;
  status: NamespaceStatus;
  type: OverviewType;
};

class OverviewStatuses extends React.Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const targetPage = switchType(this.props.type, TargetPage.APPLICATIONS, TargetPage.SERVICES, TargetPage.WORKLOADS);
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
        <ListPageLink target={targetPage} namespaces={[{ name: name }]}>
          {text}
        </ListPageLink>
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

export default OverviewStatuses;
