import * as React from 'react';
import { Title, TitleSizes, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { IRow, SortByDirection } from '@patternfly/react-table';
import { Link } from 'react-router-dom-v5-compat';
import { TrafficItem, TrafficNode, TrafficDirection } from './TrafficDetails';
import * as FilterComponent from '../FilterList/FilterComponent';
import { ThresholdStatus, NA } from 'types/Health';
import { NodeType, hasProtocolTraffic, ProtocolTraffic } from 'types/Graph';
import { getTrafficHealth } from 'types/ErrorRate';
import { location, URLParam } from 'app/History';
import { sortFields } from './FiltersAndSorts';
import { SortField } from 'types/SortFilters';
import { PFBadgeType, PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { createIcon, createTooltipIcon, KialiIcon } from 'config/KialiIcon';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { isParentKiosk, kioskContextMenuAction } from '../Kiosk/KioskActions';
import { isMultiCluster } from 'config';
import { getParamsSeparator } from '../../utils/SearchParamUtils';
import { SimpleTable, SortableTh } from 'components/Table/SimpleTable';

export interface TrafficListItem {
  badge: PFBadgeType;
  cluster?: string;
  direction: TrafficDirection;
  healthStatus: ThresholdStatus;
  mTLS?: number;
  node: TrafficNode;
  protocol: string;
  trafficPercentSuccess: string;
  trafficRate: string;
}

type ReduxProps = {
  kiosk: string;
};

type TrafficListComponentProps = ReduxProps &
  FilterComponent.Props<TrafficListItem> & {
    trafficItems: TrafficItem[];
  };

type TrafficListComponentState = FilterComponent.State<TrafficListItem>;

const columns = (isMultiCluster: boolean): SortableTh[] => {
  const cols: SortableTh[] = [
    {
      title: 'Status',
      sortable: true,
      width: 15
    },
    {
      title: 'Name',
      sortable: true,
      width: 30
    },
    {
      title: 'Rate',
      sortable: true,
      width: 10
    },
    {
      title: 'Percent Success',
      sortable: true,
      width: 20
    },
    {
      title: 'Protocol',
      sortable: true,
      width: 15
    },
    {
      title: 'Actions',
      sortable: false
    }
  ];

  if (isMultiCluster) {
    cols.splice(2, 0, {
      title: 'Cluster',
      sortable: true,
      width: 15
    });
  }

  return cols;
};

const LockIcon = (props: { mTLS?: number }): React.ReactElement => {
  const msg = props.mTLS ? `${props.mTLS} % of mTLS traffic` : 'mTLS is disabled';

  return (
    <Tooltip position={TooltipPosition.top} content={msg}>
      <>
        {props.mTLS ? (
          <KialiIcon.MtlsLock className={lockIconStyle} />
        ) : (
          <KialiIcon.MtlsUnlock className={lockIconStyle} />
        )}
      </>
    </Tooltip>
  );
};

// Style constants
const containerStyle = kialiStyle({ padding: '1.25rem' });
const lockIconStyle = kialiStyle({ marginLeft: '0.25rem' });

class TrafficList extends FilterComponent.Component<
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

  componentDidMount(): void {
    // ensure the initial sort is applied
    this.sortItemList(this.state.listItems, this.state.currentSortField, this.state.isSortAscending);
  }

  componentDidUpdate(prevProps: TrafficListComponentProps): void {
    // we only care about new TrafficItems, sorting is managed locally after initial render
    if (prevProps.trafficItems !== this.props.trafficItems) {
      const listItems = this.trafficToListItems(this.props.trafficItems);

      this.setState({
        listItems: this.sortItemList(listItems, this.state.currentSortField, this.state.isSortAscending)
      });
    }
  }

  render(): React.ReactNode {
    const cols = columns(isMultiCluster);
    const inboundRows = this.rows('inbound');
    const outboundRows = this.rows('outbound');
    const hasInbound = inboundRows.length > 0;
    const hasOutbound = outboundRows.length > 0;
    const sortIndex = sortFields.findIndex(sf => sf.id === this.state.currentSortField.id);
    const sortDirection = this.state.isSortAscending ? SortByDirection.asc : SortByDirection.desc;
    const sortBy = { index: sortIndex, direction: sortDirection };

    return (
      <>
        <div className={containerStyle}>
          <Title headingLevel="h5" size={TitleSizes.lg}>
            {hasInbound ? '' : 'No '} Inbound Traffic
          </Title>

          {hasInbound && (
            <SimpleTable
              label="Inbound Traffic List"
              columns={cols}
              rows={inboundRows}
              sortBy={sortBy}
              onSort={this.onSort}
            />
          )}
        </div>

        <div className={containerStyle}>
          <Title headingLevel="h5" size={TitleSizes.lg}>
            {hasOutbound ? '' : 'No '} Outbound Traffic
          </Title>

          {hasOutbound && (
            <SimpleTable
              label="Outbound Traffic List"
              columns={cols}
              rows={outboundRows}
              sortBy={sortBy}
              onSort={this.onSort}
            />
          )}
        </div>
      </>
    );
  }

  // abstract FilterComponent.updateListItems
  updateListItems(): void {
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
  onSort = (_event: React.MouseEvent, index: number, sortDirection: SortByDirection): void => {
    // Map the column index to the correct sortField index (currently ordered with the same indexes)
    let sortField = sortFields[index];

    const isSortAscending = sortDirection === SortByDirection.asc;

    this.updateSort(sortField, isSortAscending);
  };

  trafficToListItems(trafficItems: TrafficItem[]): TrafficListItem[] {
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
        protocol: (ti.traffic.protocol ?? 'N/A').toUpperCase(),
        mTLS: ti.mTLS,
        healthStatus: this.getHealthStatus(ti),
        cluster: ti.node.cluster,
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

  private getTraffic = (traffic: ProtocolTraffic): { trafficPercentSuccess: string; trafficRate: string } => {
    let rps = '0';
    let percentError = '0';
    let unit = 'rps';

    if (hasProtocolTraffic(traffic)) {
      switch (traffic.protocol) {
        case 'http':
          rps = traffic.rates.http;
          percentError = traffic.rates.httpPercentErr ?? '0';
          break;
        case 'grpc':
          rps = traffic.rates.grpc;
          percentError = traffic.rates.grpcPercentErr ?? '0';
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
    const parentKiosk = isParentKiosk(this.props.kiosk);

    return this.state.listItems
      .filter(i => i.direction === direction)
      .map((item, i) => {
        const name = item.node.name;
        const links = this.getLinks(item);

        let irow: IRow = {
          cells: [
            <Tooltip
              key={`tt_status_${i}`}
              position={TooltipPosition.top}
              content={<>Traffic Status: {item.healthStatus.status.name}</>}
            >
              {createTooltipIcon(createIcon(item.healthStatus.status))}
            </Tooltip>,
            <>
              <PFBadge badge={item.badge} position={TooltipPosition.top} keyValue={`tt_badge_${i}`} />
              {!!links.detail ? (
                parentKiosk ? (
                  <Link
                    key={`link_d_${item.badge}_${name}`}
                    to=""
                    onClick={() => {
                      kioskContextMenuAction(links.detail);
                    }}
                  >
                    {name}
                  </Link>
                ) : (
                  <Link key={`link_d_${item.badge}_${name}`} to={links.detail}>
                    {name}
                  </Link>
                )
              ) : (
                name
              )}
            </>,
            <>{item.trafficRate}</>,
            <>{item.trafficPercentSuccess}</>,
            <>
              {item.protocol}
              <LockIcon mTLS={item.mTLS}></LockIcon>
            </>,
            <>
              {!!links.metrics &&
                (parentKiosk ? (
                  <Link
                    key={`link_m_${item.badge}_${name}`}
                    to=""
                    onClick={() => {
                      kioskContextMenuAction(links.metrics);
                    }}
                  >
                    View metrics
                  </Link>
                ) : (
                  <Link key={`link_m_${item.badge}_${name}`} to={links.metrics}>
                    View metrics
                  </Link>
                ))}
            </>
          ]
        };

        if (isMultiCluster) {
          if (irow.cells) {
            irow.cells.splice(
              2,
              0,
              <>
                <PFBadge badge={PFBadges.Cluster} position={TooltipPosition.right} />
                {item.cluster}
              </>
            );
          }
        }

        return irow;
      });
  };

  private getLinks = (item: TrafficListItem): { detail: string; metrics: string } => {
    if (item.node.isInaccessible) {
      return { detail: '', metrics: '' };
    }

    let detail = `/namespaces/${item.node.namespace}/${this.nodeTypeToType(item.node.type, true)}/${item.node.name}`;

    if (item.node.cluster && isMultiCluster) {
      detail += `?clusterName=${item.node.cluster}`;
    }

    const metricsDirection = item.direction === 'inbound' ? 'in_metrics' : 'out_metrics';
    const pathname = location.getPathname();
    let metrics = `${pathname}${getParamsSeparator(pathname)}tab=${metricsDirection}`;

    switch (item.node.type) {
      case NodeType.APP:
        // All metrics tabs can filter by remote app. No need to switch context.
        const side = item.direction === 'inbound' ? 'source' : 'destination';
        metrics += `&${URLParam.BY_LABELS}=${encodeURIComponent(`${side}_canonical_service=${item.node.name}`)}`;
        break;
      case NodeType.SERVICE:
        if (item.node.isServiceEntry) {
          // Service Entries should be only destination nodes. So, don't build a link if direction is inbound.
          if (item.direction !== 'inbound' && item.node.destServices && item.node.destServices.length > 0) {
            const svcHosts = item.node.destServices.map(item => item.name).join(',');
            metrics += `&${URLParam.BY_LABELS}=${encodeURIComponent(`destination_service_name=${svcHosts}`)}`;
          } else {
            metrics = '';
          }
        } else {
          // Filter by remote service only available in the Outbound Metrics tab. For inbound traffic,
          // switch context to the service details page.
          if (item.direction === 'outbound') {
            metrics += `&${URLParam.BY_LABELS}=${encodeURIComponent(`destination_service_name=${item.node.name}`)}`;
          } else {
            // Services have only one metrics tab.
            metrics = `${detail}${getParamsSeparator(detail)}tab=metrics`;
          }
        }
        break;
      case NodeType.WORKLOAD:
        // No filters available for workloads. Context switch is mandatory.

        // Since this will switch context (i.e. will redirect the user to the workload details page),
        // user is redirected to the "opposite" metrics. When looking at certain item, if traffic is *inbound*
        // from a certain workload, that traffic is reflected in the *outbound* metrics of the workload (and vice-versa).
        const inverseMetricsDirection = item.direction === 'inbound' ? 'out_metrics' : 'in_metrics';
        metrics = `${detail}${getParamsSeparator(detail)}tab=${inverseMetricsDirection}`;
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

const mapStateToProps = (state: KialiAppState): ReduxProps => {
  return {
    kiosk: state.globalState.kiosk
  };
};

export const TrafficListComponent = connect(mapStateToProps)(TrafficList);
