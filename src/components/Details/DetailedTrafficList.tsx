import { Icon } from 'patternfly-react';
import { TableGrid } from 'patternfly-react-extensions';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { NodeType, ProtocolTraffic } from '../../types/Graph';
import { Direction } from '../../types/MetricsOptions';
import { REQUESTS_THRESHOLDS } from '../../types/Health';

type DetailedTrafficProps = {
  direction: Direction;
  traffic: TrafficItem[];
};

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
}

export interface UnknownNode {
  id: string;
  type: NodeType.UNKNOWN;
  namespace: string;
  name: 'unknown';
}

export type TrafficNode = WorkloadNode | ServiceNode | UnknownNode | AppNode;

export interface TrafficItem {
  node: TrafficNode;
  proxy?: TrafficItem;
  traffic: ProtocolTraffic;
}

const statusColumnSizes = {
  md: 1,
  sm: 1,
  xs: 1
};
const workloadColumnSizes = {
  md: 3,
  sm: 3,
  xs: 3
};
const typeColumnSizes = statusColumnSizes;
const trafficColumnSizes = workloadColumnSizes;

class DetailedTrafficList extends React.Component<DetailedTrafficProps> {
  render() {
    const sortedTraffic = this.getSortedTraffic();

    return (
      <TableGrid id="table-grid" bordered={true} selectType="none" style={{ clear: 'both' }}>
        <TableGrid.Head>
          <TableGrid.ColumnHeader {...statusColumnSizes}>Status</TableGrid.ColumnHeader>
          <TableGrid.ColumnHeader {...workloadColumnSizes}>
            {this.props.direction === 'inbound' ? 'Source' : 'Destination'}
          </TableGrid.ColumnHeader>
          <TableGrid.ColumnHeader {...typeColumnSizes}>Type</TableGrid.ColumnHeader>
          <TableGrid.ColumnHeader {...trafficColumnSizes}>Traffic</TableGrid.ColumnHeader>
        </TableGrid.Head>
        <TableGrid.Body>
          {sortedTraffic.length === 0 && (
            <TableGrid.Row>
              <TableGrid.Col md={10} sm={10} xs={10}>
                <Icon type="pf" name="info" /> Not enough {this.props.direction} traffic to generate info
              </TableGrid.Col>
            </TableGrid.Row>
          )}
          {sortedTraffic.map(item => {
            return (
              <TableGrid.Row key={item.node.id}>
                {this.renderStatusColumn(item.traffic)}
                {this.renderWorkloadColumn(item.node)}
                {this.renderTypeColumn(item.traffic)}
                {this.renderTrafficColumn(item.traffic)}
              </TableGrid.Row>
            );
          })}
        </TableGrid.Body>
      </TableGrid>
    );
  }

  private renderStatusColumn = (traffic: ProtocolTraffic) => {
    if (traffic.protocol === 'tcp' || traffic.protocol === '') {
      return (
        <TableGrid.Col {...statusColumnSizes}>
          <Icon type="pf" name="unknown" />
        </TableGrid.Col>
      );
    } else {
      let percentError: number;
      if (traffic.protocol === 'http') {
        percentError = traffic.rates.httpPercentErr ? Number(traffic.rates.httpPercentErr) : 0;
      } else {
        percentError = traffic.rates.grpcPercentErr ? Number(traffic.rates.grpcPercentErr) : 0;
      }

      let healthIcon = <Icon type="pf" name="ok" />;

      if (percentError > REQUESTS_THRESHOLDS.failure) {
        healthIcon = <Icon type="pf" name="error-circle-o" />;
      } else if (percentError > REQUESTS_THRESHOLDS.degraded) {
        healthIcon = <Icon type="pf" name="warning-triangle-o" />;
      }

      return <TableGrid.Col {...statusColumnSizes}>{healthIcon}</TableGrid.Col>;
    }
  };

  private renderWorkloadColumn = (node: TrafficNode) => {
    let icon = <Icon type="pf" name="unknown" style={{ paddingLeft: '2em' }} />;
    let name = <>{node.name}</>;

    if (NodeType.WORKLOAD === node.type) {
      icon = <Icon type="pf" name="bundle" style={{ paddingLeft: '2em' }} />;
      if (!node.isInaccessible) {
        name = (
          <Link to={`/namespaces/${encodeURIComponent(node.namespace)}/workloads/${encodeURIComponent(node.name)}`}>
            {node.name}
          </Link>
        );
      }
    } else if (NodeType.SERVICE === node.type) {
      icon = <Icon type="pf" name="service" />;
      if (!node.isServiceEntry || !node.isInaccessible) {
        name = (
          <Link to={`/namespaces/${encodeURIComponent(node.namespace)}/services/${encodeURIComponent(node.name)}`}>
            {node.name}
          </Link>
        );
      }
    } else if (NodeType.APP === node.type) {
      icon = <Icon type="pf" name="applications" style={{ paddingLeft: '2em' }} />;
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
              `${node.name} / ${node.version}`
            </Link>
          );
        }
      }
    }

    return (
      <TableGrid.Col {...workloadColumnSizes}>
        {icon} {name}
      </TableGrid.Col>
    );
  };

  private renderTrafficColumn = (traffic: ProtocolTraffic) => {
    if (traffic.protocol === 'tcp') {
      return <TableGrid.Col {...trafficColumnSizes}>{Number(traffic.rates.tcp).toFixed(2)}</TableGrid.Col>;
    } else if (traffic.protocol === '') {
      return <TableGrid.Col {...trafficColumnSizes}>N/A</TableGrid.Col>;
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
        <TableGrid.Col {...trafficColumnSizes}>
          {rps.toFixed(2)}rps | {(100 - percentError).toFixed(1)}% success
        </TableGrid.Col>
      );
    }
  };

  private renderTypeColumn = (traffic: ProtocolTraffic) => {
    if (traffic.protocol === '') {
      return <TableGrid.Col {...typeColumnSizes}>N/A</TableGrid.Col>;
    }

    return <TableGrid.Col {...typeColumnSizes}>{traffic.protocol.toUpperCase()}</TableGrid.Col>;
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
