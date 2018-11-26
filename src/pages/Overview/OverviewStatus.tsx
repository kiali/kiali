import * as React from 'react';
import { AggregateStatusNotification, Icon, OverlayTrigger, Popover } from 'patternfly-react';

import { ListPageLink, TargetPage } from '../../components/ListPage/ListPageLink';
import { Status } from '../../types/Health';

type Props = {
  id: string;
  namespace: string;
  status: Status;
  items: string[];
  targetPage: TargetPage;
};

class OverviewStatus extends React.Component<Props, {}> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const length = this.props.items.length;
    let items = this.props.items;
    if (items.length > 6) {
      items = items.slice(0, 5);
      items.push('and ' + (length - items.length) + ' more...');
    }
    return (
      <OverlayTrigger
        // Prettier makes irrelevant line-breaking clashing with tslint
        // prettier-ignore
        overlay={<Popover id={this.props.id} title={this.props.status.name}>
            {items.map((app, idx) => {
              return (<div key={this.props.id + '-' + idx}>{app}</div>);
            })}
          </Popover>}
        placement="top"
        trigger={['focus', 'hover']}
        rootClose={true}
      >
        <AggregateStatusNotification>
          <ListPageLink target={this.props.targetPage} namespace={this.props.namespace} health={this.props.status.name}>
            <Icon type="pf" name={this.props.status.icon} />
            {length}
          </ListPageLink>
        </AggregateStatusNotification>
      </OverlayTrigger>
    );
  }
}

export default OverviewStatus;
