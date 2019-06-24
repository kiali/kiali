import * as React from 'react';
import { AggregateStatusNotification, Icon, OverlayTrigger, Popover } from 'patternfly-react';
import { Link } from 'react-router-dom';
import { Status } from '../../types/Health';
import { Paths } from '../../config';
import { ActiveFilter } from '../../types/Filters';
import { healthFilter } from '../../components/Filters/CommonFilters';
import { FilterSelected } from '../../components/Filters/StatefulFilters';

type Props = {
  id: string;
  namespace: string;
  status: Status;
  items: string[];
  targetPage: Paths;
};

class OverviewStatus extends React.Component<Props, {}> {
  setFilters = () => {
    const filters: (ActiveFilter & { id: string })[] = [
      {
        id: healthFilter.id,
        category: healthFilter.title,
        value: this.props.status.name
      }
    ];
    FilterSelected.setSelected(filters);
  };

  render() {
    const length = this.props.items.length;
    let items = this.props.items;
    if (items.length > 6) {
      items = items.slice(0, 5);
      items.push('and ' + (length - items.length) + ' more...');
    }
    return (
      <OverlayTrigger
        // Prettier makes irrelevant line-breaking clashing withtslint
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
          <Link to={`/${this.props.targetPage}?namespaces=${this.props.namespace}`} onClick={() => this.setFilters()}>
            <Icon type="pf" name={this.props.status.icon} />
            {length}
          </Link>
        </AggregateStatusNotification>
      </OverlayTrigger>
    );
  }
}

export default OverviewStatus;
