import { ApplicationsIcon, BundleIcon, InfoAltIcon, ServiceIcon, UnknownIcon } from '@patternfly/react-icons';
import { cellWidth, ICell, IRow, Table, TableBody, TableHeader, TableVariant } from '@patternfly/react-table';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { NodeType, ProtocolTraffic, hasProtocolTraffic, DestService } from '../../types/Graph';
import { Direction } from '../../types/MetricsOptions';
import history, { URLParam } from '../../app/History';
import { style } from 'typestyle';
import { getTrafficHealth } from '../../types/ErrorRate';
import { NA } from '../../types/Health';
import { createIcon } from '../../components/Health/Helper';

type DetailedTrafficProps = {
  direction: Direction;
  header?: string;
  traffic: TrafficItem[];
};

export interface AggregateNode {
  id: string;
  type: NodeType.AGGREGATE;
  namespace: string;
  name: string;
  version: string;
  isInaccessible: boolean;
}

export interface AppNode {
  id: string;
  type: NodeType.APP;
  namespace: string;
  name: string;
  version: string;
  isInaccessible: boolean;
}

export interface WorkloadNode {
  id: string;
  type: NodeType.WORKLOAD;
  namespace: string;
  name: string;
  isInaccessible: boolean;
}

export interface ServiceNode {
  id: string;
  type: NodeType.SERVICE;
  namespace: string;
  name: string;
  isServiceEntry?: string;
  isInaccessible: boolean;
  destServices?: DestService[];
}

export interface UnknownNode {
  id: string;
  type: NodeType.UNKNOWN;
  namespace: string;
  name: 'unknown';
}

export type TrafficNode = AggregateNode | AppNode | ServiceNode | UnknownNode | WorkloadNode;

export interface TrafficItem {
  node: TrafficNode;
  proxy?: TrafficItem;
  traffic: ProtocolTraffic;
}

const headerStyle = style({
  fontWeight: 'bold',
  color: 'black'
});

class DetailedTrafficList extends React.Component<DetailedTrafficProps> {
  static STATUS_COLUMN_IDX = 0;
  static WORKLOAD_COLUMN_IDX = 1;
  static PROTOCOL_COLUMN_IDX = 2;
  static TRAFFIC_COLUMN_IDX = 3;
  static METRICS_LINK_COLUMN_IDX = 4;
  static HEADER_PROPS = { style: { color: '#72767b', fontWeight: 300, fontSize: '12px' } };
  static COLUMN_PROPS = { style: { color: 'black', fontWeight: 400, fontSize: '1rem', verticalAlign: 'middle' } };
  // TODO: Casting 'as any' because @patternfly/react-table@2.22.19 has a typing bug. Remove the casting when PF fixes it.
  // https://github.com/patternfly/patternfly-next/issues/2373
  columns = (): ICell[] => {
    return [
      { title: 'STATUS', transforms: [cellWidth(10) as any], props: DetailedTrafficList.HEADER_PROPS },
      {
        title: this.props.direction === 'inbound' ? 'SOURCE' : 'DESTINATION',
        transforms: [cellWidth(30) as any],
        props: DetailedTrafficList.HEADER_PROPS
      },
      { title: 'TYPE', transforms: [cellWidth(10) as any], props: DetailedTrafficList.HEADER_PROPS },
      { title: 'TRAFFIC', transforms: [cellWidth(30) as any], props: DetailedTrafficList.HEADER_PROPS },
      { title: '', transforms: [cellWidth(10) as any], props: DetailedTrafficList.HEADER_PROPS }
    ];
  };

  noSortedTraffic = (): IRow[] => {
    return [
      {
        cells: [
          {
            title: (
              <>
                <InfoAltIcon /> Not enough {this.props.direction} traffic to generate info
              </>
            ),
            props: { colSpan: 5 }
          }
        ]
      }
    ];
  };

  rows = (): IRow[] => {
    const sortedTraffic = this.getSortedTraffic();
    let rows: IRow[] = [];
    sortedTraffic.map(item =>
      rows.push({
        cells: [
          { title: this.renderStatusColumn(item), props: DetailedTrafficList.COLUMN_PROPS },
          {
            title: this.renderWorkloadColumn(item.node, item.proxy !== undefined),
            props: DetailedTrafficList.COLUMN_PROPS
          },
          { title: this.renderTypeColumn(item.traffic), props: DetailedTrafficList.COLUMN_PROPS },
          { title: this.renderTrafficColumn(item.traffic), props: DetailedTrafficList.COLUMN_PROPS },
          { title: this.renderMetricsLinksColumn(item.node), props: DetailedTrafficList.COLUMN_PROPS }
        ]
      })
    );
    return rows;
  };

  render() {
    const sortedTraffic = this.getSortedTraffic();

    return (
      <>
        <Table
          caption={<span className={headerStyle}>{this.props.header}</span>}
          variant={TableVariant.compact}
          cells={this.columns()}
          rows={sortedTraffic.length === 0 ? this.noSortedTraffic() : this.rows()}
        >
          <TableHeader />
          <TableBody />
        </Table>
      </>
    );
  }

  private renderMetricsLinksColumn = (node: TrafficNode) => {
    const metricsDirection = this.props.direction === 'inbound' ? 'in_metrics' : 'out_metrics';
    let metricsLink = history.location.pathname + '?';
    metricsLink += `tab=${metricsDirection}`;

    if (node.type === NodeType.APP) {
      // All metrics tabs can filter by remote app. No need to switch context.
      const side = this.props.direction === 'inbound' ? 'source' : 'destination';
      metricsLink += '&' + URLParam.BY_LABELS + '=' + encodeURIComponent(side + '_app=' + node.name);
    } else if (node.type === NodeType.SERVICE) {
      if (node.isServiceEntry) {
        // Service Entries should be only destination nodes. So, don't build a link if direction is inbound.
        if (this.props.direction === 'inbound') {
          return null;
        }

        if (node.destServices && node.destServices.length > 0) {
          const svcHosts = node.destServices.map(item => item.name).join(',');
          metricsLink += '&' + URLParam.BY_LABELS + '=' + encodeURIComponent('destination_service_name=' + svcHosts);
        } else {
          return null;
        }
      } else {
        // Filter by remote service only available in the Outbound Metrics tab. For inbound traffic,
        // switch context to the service details page.
        if (this.props.direction === 'outbound') {
          metricsLink += '&' + URLParam.BY_LABELS + '=' + encodeURIComponent('destination_service_name=' + node.name);
        } else {
          // Services have only one metrics tab.
          metricsLink = `/namespaces/${node.namespace}/services/${node.name}?tab=metrics`;
        }
      }
    } else if (node.type === NodeType.WORKLOAD) {
      // No filters available for workloads. Context switch is mandatory.

      // Since this will switch context (i.e. will redirect the user to the workload details page),
      // user is redirected to the "opposite" metrics. When looking at certain item, if traffic is *incoming*
      // from a certain workload, that traffic is reflected in the *outbound* metrics of the workload (and vice-versa).
      const inverseMetricsDirection = this.props.direction === 'inbound' ? 'out_metrics' : 'in_metrics';
      metricsLink = `/namespaces/${node.namespace}/workloads/${node.name}?tab=${inverseMetricsDirection}`;
    } else {
      return null;
    }

    return <Link to={metricsLink}>View metrics</Link>;
  };

  private renderStatusColumn = (item: TrafficItem) => {
    const traffic = item.traffic;
    if (traffic.protocol !== 'tcp' && hasProtocolTraffic(traffic)) {
      const status = getTrafficHealth(item, this.props.direction);
      return createIcon(status.status, 'md');
    } else {
      return createIcon(NA, 'md');
    }
  };

  private renderWorkloadColumn = (node: TrafficNode, isProxyed: boolean) => {
    const style = isProxyed ? { marginLeft: '2em', marginRight: '4px' } : { marginRight: '4px' };
    let icon = <UnknownIcon size={'md'} style={style} />;
    let name = <>{node.name}</>;

    if (NodeType.WORKLOAD === node.type) {
      icon = <BundleIcon size={'md'} style={style} />;
      if (!node.isInaccessible) {
        name = (
          <Link to={`/namespaces/${encodeURIComponent(node.namespace)}/workloads/${encodeURIComponent(node.name)}`}>
            {node.name}
          </Link>
        );
      }
    } else if (NodeType.SERVICE === node.type) {
      icon = <ServiceIcon size={'md'} style={style} />;
      if (!node.isServiceEntry && !node.isInaccessible) {
        name = (
          <Link to={`/namespaces/${encodeURIComponent(node.namespace)}/services/${encodeURIComponent(node.name)}`}>
            {node.name}
          </Link>
        );
      }
    } else if (NodeType.APP === node.type) {
      icon = <ApplicationsIcon size={'md'} style={style} />;
      if (!node.isInaccessible) {
        name = (
          <Link to={`/namespaces/${encodeURIComponent(node.namespace)}/applications/${encodeURIComponent(node.name)}`}>
            {node.name}
          </Link>
        );
        if (node.version) {
          name = (
            <Link
              to={`/namespaces/${encodeURIComponent(node.namespace)}/applications/${encodeURIComponent(node.name)}`}
            >
              {`${node.name} / ${node.version}`}
            </Link>
          );
        }
      }
    }

    return (
      <>
        {icon} <span style={{ verticalAlign: 'text-bottom' }}>{name}</span>
      </>
    );
  };

  private renderTrafficColumn = (traffic: ProtocolTraffic) => {
    if (hasProtocolTraffic(traffic)) {
      if (traffic.protocol === 'tcp') {
        return Number(traffic.rates.tcp).toFixed(2);
      } else {
        let rps: number;
        let percentError: number;

        if (traffic.protocol === 'http') {
          rps = Number(traffic.rates.http);
          percentError = traffic.rates.httpPercentErr ? Number(traffic.rates.httpPercentErr) : 0;
        } else {
          rps = Number(traffic.rates.grpc);
          percentError = traffic.rates.grpcPercentErr ? Number(traffic.rates.grpcPercentErr) : 0;
        }

        return (
          <>
            {rps.toFixed(2)}rps | {(100 - percentError).toFixed(1)}% success
          </>
        );
      }
    } else {
      return 'N/A';
    }
  };

  private renderTypeColumn = (traffic: ProtocolTraffic) => {
    if (!traffic.protocol) {
      return 'N/A';
    }

    return traffic.protocol.toUpperCase();
  };

  private getSortedTraffic = () => {
    const sortFn = (a: TrafficItem, b: TrafficItem) => {
      if (!a.proxy && !b.proxy) {
        return a.node.name.localeCompare(b.node.name);
      } else if (a.proxy && b.proxy) {
        const proxyCompare = a.proxy.node.name.localeCompare(b.proxy.node.name);
        if (proxyCompare === 0) {
          return a.node.name.localeCompare(b.node.name);
        }

        return proxyCompare;
      } else {
        const proxyedItem: TrafficItem = a.proxy ? a : b;
        const proxyItem: TrafficItem = a.proxy ? b : a;

        if (proxyItem === proxyedItem.proxy) {
          return proxyItem === a ? -1 : 1;
        }

        const cmp = proxyItem.node.name.localeCompare(proxyedItem.proxy!.node.name);
        return proxyItem === a ? cmp : -cmp;
      }
    };

    return this.props.traffic.slice().sort(sortFn);
  };
}

export default DetailedTrafficList;
