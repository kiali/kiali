import * as React from 'react';
import { Title, TitleSizes, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { style } from 'typestyle';
import { IRow, sortable, SortByDirection, Table, TableBody, TableHeader, cellWidth } from '@patternfly/react-table';
import { Link } from 'react-router-dom';
import { TrafficItem, TrafficNode, TrafficDirection } from './TrafficDetails';
import * as FilterComponent from '../FilterList/FilterComponent';
import { ThresholdStatus, NA } from 'types/Health';
import { NodeType, hasProtocolTraffic, ProtocolTraffic } from 'types/Graph';
import { getTrafficHealth } from 'types/ErrorRate';
import history, { URLParam } from 'app/History';
import { createIcon } from 'components/Health/Helper';
import { sortFields } from './FiltersAndSorts';
import { SortField } from 'types/SortFilters';
import { PFBadgeType, PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { createTooltipIcon } from 'config/KialiIcon';

export interface TrafficListItem {
  direction: TrafficDirection;
  healthStatus: ThresholdStatus;
  badge: PFBadgeType;
  node: TrafficNode;
  protocol: string;
  trafficRate: string;
  trafficPercentSuccess: string;
}

type TrafficListComponentProps = FilterComponent.Props<TrafficListItem> & {
  trafficItems: TrafficItem[];
};

type TrafficListComponentState = FilterComponent.State<TrafficListItem>;

const columns = [
  {
    title: 'Status',
    transforms: [sortable, cellWidth(15)]
  },
  {
    title: 'Name',
    transforms: [sortable, cellWidth(30)]
  },
  {
    title: 'Rate',
    transforms: [sortable, cellWidth(10)]
  },
  {
    title: 'Percent Success',
    transforms: [sortable, cellWidth(20)]
  },
  {
    title: 'Protocol',
    transforms: [sortable, cellWidth(15)]
  },
  {
    title: 'Actions'
  }
];

// Style constants
const containerPadding = style({ padding: '20px' });

class TrafficListComponent extends FilterComponent.Component<
  TrafficListComponentProps,
  TrafficListComponentState,
  TrafficListItem
> {
  constructor(props: TrafficListComponentProps) {
    super(props);
    this.state = {
      currentSortField: props.currentSortField,
      isSortAscending: props.isSortAscending,
      listItems: this.trafficToListItems(props.trafficItems)
    };
  }

  componentDidMount() {
    // ensure the initial sort is applied
    this.sortItemList(this.state.listItems, this.state.currentSortField, this.state.isSortAscending);
  }

  componentDidUpdate(prevProps: TrafficListComponentProps, _prevState: TrafficListComponentState, _snapshot: any) {
    // we only care about new TrafficItems, sorting is managed locally after initial render
    if (prevProps.trafficItems !== this.props.trafficItems) {
      const listItems = this.trafficToListItems(this.props.trafficItems);
      this.setState({
        listItems: this.sortItemList(listItems, this.state.currentSortField, this.state.isSortAscending)
      });
    }
  }

  render() {
    const inboundRows = this.rows('inbound');
    const outboundRows = this.rows('outbound');
    const hasInbound = inboundRows.length > 0;
    const hasOutbound = outboundRows.length > 0;
    const sortIndex = sortFields.findIndex(sf => sf.id === this.props.currentSortField.id);
    const sortDirection = this.props.isSortAscending ? SortByDirection.asc : SortByDirection.desc;
    const sortBy = { index: sortIndex, direction: sortDirection };
    return (
      <>
        <div className={containerPadding}>
          <Title headingLevel="h5" size={TitleSizes.lg}>
            {hasInbound ? '' : 'No '} Inbound Traffic
          </Title>
          {hasInbound && (
            <Table aria-label="Sortable Table" cells={columns} onSort={this.onSort} rows={inboundRows} sortBy={sortBy}>
              <TableHeader />
              <TableBody />
            </Table>
          )}
        </div>
        <div className={containerPadding}>
          <Title headingLevel="h5" size={TitleSizes.lg}>
            {hasOutbound ? '' : 'No '} Outbound Traffic
          </Title>
          {hasOutbound && (
            <Table aria-label="Sortable Table" cells={columns} onSort={this.onSort} rows={outboundRows} sortBy={sortBy}>
              <TableHeader />
              <TableBody />
            </Table>
          )}
        </div>
      </>
    );
  }

  // abstract FilterComponent.updateListItems
  updateListItems() {
    // we don't react to filter changes in this class, so this is a no-op
  }

  // abstract FilterComponent.sortItemList
  sortItemList(
    listItems: TrafficListItem[],
    sortField: SortField<TrafficListItem>,
    isAscending: boolean
  ): TrafficListItem[] {
    return listItems.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
  }

  // Helper used for Table to sort handlers based on index column == field
  onSort = (_event, index, sortDirection) => {
    // Map the column index to the correct sortField index (currently ordered with the same indexes)
    let sortField = sortFields[index];

    const isSortAscending = sortDirection === SortByDirection.asc;
    if (sortField.id !== this.state.currentSortField.id || isSortAscending !== this.state.isSortAscending) {
      this.updateSort(sortField, isSortAscending);
    }
  };

  trafficToListItems(trafficItems: TrafficItem[]) {
    const listItems = trafficItems.map(ti => {
      let badge: PFBadgeType;
      switch (ti.node.type) {
        case NodeType.APP:
          badge = PFBadges.App;
          break;
        case NodeType.SERVICE:
          badge = PFBadges.Service;
          break;
        default:
          badge = PFBadges.Workload;
      }
      const item: TrafficListItem = {
        direction: ti.direction,
        badge: badge,
        node: ti.node,
        protocol: (ti.traffic.protocol || 'N/A').toUpperCase(),
        healthStatus: this.getHealthStatus(ti),
        ...this.getTraffic(ti.traffic)
      };
      return item;
    });

    return listItems;
  }

  private getHealthStatus = (item: TrafficItem): ThresholdStatus => {
    const traffic = item.traffic;

    if (traffic.protocol !== 'tcp' && hasProtocolTraffic(traffic)) {
      return getTrafficHealth(item, item.direction);
    }

    return { value: 0, status: NA };
  };

  private getTraffic = (traffic: ProtocolTraffic): { trafficRate; trafficPercentSuccess } => {
    let rps = '0';
    let percentError = '0';
    let unit = 'rps';
    if (hasProtocolTraffic(traffic)) {
      switch (traffic.protocol) {
        case 'http':
          rps = traffic.rates.http;
          percentError = traffic.rates.httpPercentErr || '0';
          break;
        case 'grpc':
          rps = traffic.rates.grpc;
          percentError = traffic.rates.grpcPercentErr || '0';
          break;
        case 'tcp':
          rps = traffic.rates.tcp;
          break;
      }
    }

    return {
      trafficRate: `${Number(rps).toFixed(2)}${unit}`,
      trafficPercentSuccess: `${(100 - Number(percentError)).toFixed(1)}%`
    };
  };

  // Helper used to build the table content.
  rows = (direction: TrafficDirection): IRow[] => {
    return this.state.listItems
      .filter(i => i.direction === direction)
      .map((item, i) => {
        const name = item.node.name;
        const links = this.getLinks(item);
        return {
          cells: [
            <>
              <Tooltip
                key={`tt_status_${i}`}
                position={TooltipPosition.top}
                content={<>Traffic Status: {item.healthStatus.status.name}</>}
              >
                {createTooltipIcon(createIcon(item.healthStatus.status, 'sm'))}
              </Tooltip>
            </>,
            <>
              <PFBadge badge={item.badge} position={TooltipPosition.top} keyValue={`tt_badge_${i}`} />
              {!!links.detail ? (
                <Link key={`link_d_${item.badge}_${name}`} to={links.detail} className={'virtualitem_definition_link'}>
                  {name}
                </Link>
              ) : (
                name
              )}
            </>,
            <>{item.trafficRate}</>,
            <>{item.trafficPercentSuccess}</>,
            <>{item.protocol}</>,
            <>
              {!!links.metrics && (
                <Link key={`link_m_${item.badge}_${name}`} to={links.metrics} className={'virtualitem_definition_link'}>
                  View metrics
                </Link>
              )}
            </>
          ]
        };
      });
  };

  private getLinks = (item: TrafficListItem) => {
    if (item.node.isInaccessible) {
      return { detail: '', metrics: '' };
    }

    const detail = `/namespaces/${item.node.namespace}/${this.nodeTypeToType(item.node.type, true)}/${item.node.name}`;

    const metricsDirection = item.direction === 'inbound' ? 'in_metrics' : 'out_metrics';
    let metrics = `${history.location.pathname}?tab=${metricsDirection}`;

    switch (item.node.type) {
      case NodeType.APP:
        // All metrics tabs can filter by remote app. No need to switch context.
        const side = item.direction === 'inbound' ? 'source' : 'destination';
        metrics += `&${URLParam.BY_LABELS}=${encodeURIComponent(side + '_canonical_service=' + item.node.name)}`;
        break;
      case NodeType.SERVICE:
        if (item.node.isServiceEntry) {
          // Service Entries should be only destination nodes. So, don't build a link if direction is inbound.
          if (item.direction !== 'inbound' && item.node.destServices && item.node.destServices.length > 0) {
            const svcHosts = item.node.destServices.map(item => item.name).join(',');
            metrics += `&${URLParam.BY_LABELS}=${encodeURIComponent('destination_service_name=' + svcHosts)}`;
          } else {
            metrics = '';
          }
        } else {
          // Filter by remote service only available in the Outbound Metrics tab. For inbound traffic,
          // switch context to the service details page.
          if (item.direction === 'outbound') {
            metrics += `&${URLParam.BY_LABELS}=${encodeURIComponent('destination_service_name=' + item.node.name)}`;
          } else {
            // Services have only one metrics tab.
            metrics = `${detail}?tab=metrics`;
          }
        }
        break;
      case NodeType.WORKLOAD:
        // No filters available for workloads. Context switch is mandatory.

        // Since this will switch context (i.e. will redirect the user to the workload details page),
        // user is redirected to the "opposite" metrics. When looking at certain item, if traffic is *inbound*
        // from a certain workload, that traffic is reflected in the *outbound* metrics of the workload (and vice-versa).
        const inverseMetricsDirection = item.direction === 'inbound' ? 'out_metrics' : 'in_metrics';
        metrics = `${detail}?tab=${inverseMetricsDirection}`;
        break;
      default:
        metrics = '';
    }

    return { detail: detail, metrics: metrics };
  };

  private nodeTypeToType = (type: NodeType, isURL?: boolean): string => {
    switch (type) {
      case NodeType.APP:
        return isURL ? 'applications' : 'Application';
      case NodeType.SERVICE:
        return isURL ? 'services' : 'Service';
      default:
        return isURL ? 'workloads' : 'Workload';
    }
  };
}

export default TrafficListComponent;
