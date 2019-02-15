import { Col, Row, Button, Icon } from 'patternfly-react';
import * as React from 'react';
import { GraphDefinition, GraphEdgeWrapper, GraphNodeData, NodeType } from '../../types/Graph';
import DetailedTrafficList, { TrafficItem, TrafficNode } from '../Details/DetailedTrafficList';
import { DurationInSeconds } from '../../types/Common';
import { getName } from '../../utils/RateIntervals';
import { MetricsObjectTypes } from '../../types/Metrics';

type WorkloadProps = {
  itemType: MetricsObjectTypes.WORKLOAD;
  namespace: string;
  workloadName: string;
};

type AppProps = {
  itemType: MetricsObjectTypes.APP;
  namespace: string;
  appName: string;
};

type TrafficDetailsProps = {
  rateInterval: DurationInSeconds;
  trafficData: GraphDefinition | null;
  onRefresh: () => void;
} & (AppProps | WorkloadProps);

type TrafficDetailsState = {
  inboundTraffic: TrafficItem[];
  outboundTraffic: TrafficItem[];
};

type ServiceTraffic = {
  [key: string]: TrafficItem;
};

class TrafficDetails extends React.Component<TrafficDetailsProps, TrafficDetailsState> {
  constructor(props: TrafficDetailsProps) {
    super(props);
    this.state = {
      inboundTraffic: [],
      outboundTraffic: []
    };
  }

  componentDidUpdate(prevProps: TrafficDetailsProps) {
    const isWorkloadSet =
      prevProps.itemType === MetricsObjectTypes.WORKLOAD &&
      this.props.itemType === prevProps.itemType &&
      (prevProps.namespace !== this.props.namespace || prevProps.workloadName !== this.props.workloadName);
    const isAppSet =
      prevProps.itemType === MetricsObjectTypes.APP &&
      this.props.itemType === prevProps.itemType &&
      (prevProps.namespace !== this.props.namespace || prevProps.appName !== this.props.appName);

    if (isWorkloadSet || isAppSet || prevProps.trafficData !== this.props.trafficData) {
      this.processTrafficData(this.props.trafficData);
    }
  }

  render() {
    const rateIntervalName = getName(this.props.rateInterval).toLowerCase();

    if (this.props.trafficData === null) {
      return null;
    }

    return (
      <Row className="card-pf-body">
        <Col xs={12}>
          <div>
            <Button onClick={this.props.onRefresh} style={{ float: 'right' }}>
              <Icon name="refresh" />
            </Button>
            <strong>Inbound ({rateIntervalName})</strong>
          </div>
          <DetailedTrafficList direction="inbound" traffic={this.state.inboundTraffic} />
          <div style={{ marginTop: '2em' }}>
            <strong>Outbound ({rateIntervalName})</strong>
          </div>
          <DetailedTrafficList direction="outbound" traffic={this.state.outboundTraffic} />
        </Col>
      </Row>
    );
  }

  private buildTrafficNode = (prefix: 'in' | 'out', node: any): TrafficNode => {
    if (this.props.itemType === MetricsObjectTypes.WORKLOAD) {
      return {
        id: `${prefix}-${node.id}`,
        type: node.nodeType,
        namespace: node.namespace,
        name: node.workload || '',
        isInaccessible: node.isInaccessible || false
      };
    } else {
      return {
        id: `${prefix}-${node.id}`,
        type: node.nodeType,
        namespace: node.namespace,
        name: node.app || '',
        version: node.version,
        isInaccessible: node.isInaccessible || false
      };
    }
  };

  private processTrafficSiblings = (edges: any, serviceTraffic: ServiceTraffic, nodes: any, myNode: any) => {
    const inboundTraffic: TrafficItem[] = [];
    const outboundTraffic: TrafficItem[] = [];

    edges.forEach(edge => {
      const sourceNode = nodes['id-' + edge.data.source];
      const targetNode = nodes['id-' + edge.data.target];

      if (myNode.id === edge.data.source || myNode.id === edge.data.target) {
        return;
      }

      if (targetNode.nodeType === NodeType.SERVICE) {
        const svcId = `in-${targetNode.namespace}-${targetNode.service}`;
        if (serviceTraffic[svcId]) {
          inboundTraffic.push({
            traffic: edge.data.traffic,
            proxy: serviceTraffic[svcId],
            node: this.buildTrafficNode('in', sourceNode)
          });
        }
      } else if (sourceNode.nodeType === NodeType.SERVICE) {
        const svcId = `out-${sourceNode.namespace}-${sourceNode.service}`;
        if (serviceTraffic[svcId]) {
          outboundTraffic.push({
            traffic: edge.data.traffic,
            proxy: serviceTraffic[svcId],
            node: this.buildTrafficNode('out', targetNode)
          });
        }
      }
    });

    return { inboundTraffic, outboundTraffic };
  };

  private processServicesTraffic = (
    edges: GraphEdgeWrapper[],
    nodes: { [key: string]: GraphNodeData },
    myNode: GraphNodeData
  ) => {
    const serviceTraffic: ServiceTraffic = {};
    const inboundTraffic: TrafficItem[] = [];
    const outboundTraffic: TrafficItem[] = [];

    edges.forEach(edge => {
      const sourceNode = nodes['id-' + edge.data.source];
      const targetNode = nodes['id-' + edge.data.target];
      if (myNode.id === edge.data.source && targetNode.nodeType === 'service') {
        const svcId = `out-${targetNode.namespace}-${targetNode.service}`;
        if (!serviceTraffic[svcId]) {
          serviceTraffic[svcId] = {
            traffic: edge.data.traffic!,
            node: {
              id: `out-${targetNode.id}`,
              type: targetNode.nodeType,
              namespace: targetNode.namespace,
              name: targetNode.service!,
              isServiceEntry: targetNode.isServiceEntry,
              isInaccessible: targetNode.isInaccessible || false
            }
          };
          outboundTraffic.push(serviceTraffic[svcId]);
        }
      } else if (myNode.id === edge.data.target && sourceNode.nodeType === 'service') {
        const svcId = `in-${sourceNode.namespace}-${sourceNode.service}`;
        if (!serviceTraffic[svcId]) {
          serviceTraffic[svcId] = {
            traffic: edge.data.traffic!,
            node: {
              id: `in-${sourceNode.id}`,
              type: sourceNode.nodeType,
              namespace: sourceNode.namespace,
              name: sourceNode.service!,
              isServiceEntry: sourceNode.isServiceEntry,
              isInaccessible: sourceNode.isInaccessible || false
            }
          };
          inboundTraffic.push(serviceTraffic[svcId]);
        }
      }
    });

    return { serviceTraffic, inboundTraffic, outboundTraffic };
  };

  private processTrafficData = (traffic: GraphDefinition | null) => {
    if (!traffic || !traffic.elements.nodes) {
      this.setState({ inboundTraffic: [], outboundTraffic: [] });
      return;
    }

    // Index nodes by id and find the node of the queried item
    const nodes: { [key: string]: GraphNodeData } = {};
    let myNode: GraphNodeData = { id: '', nodeType: NodeType.UNKNOWN, namespace: '' };

    traffic.elements.nodes.forEach(element => {
      nodes['id-' + element.data.id] = element.data;
      if (element.data.namespace === this.props.namespace) {
        const isMyWorkload =
          this.props.itemType === MetricsObjectTypes.WORKLOAD && this.props.workloadName === element.data.workload;
        const isMyApp = this.props.itemType === MetricsObjectTypes.APP && this.props.appName === element.data.app;

        if (isMyWorkload || isMyApp) {
          myNode = element.data;
        }
      }
    });

    if (myNode.id === '') {
      // Graph endpoint didn't return a graph for the current node.
      this.setState({ inboundTraffic: [], outboundTraffic: [] });
      return;
    }

    // It's assumed that traffic is sent/received through services.
    // So, process traffic to/from services first.
    const {
      serviceTraffic,
      inboundTraffic: servicesInbound,
      outboundTraffic: servicesOutbound
    } = this.processServicesTraffic(traffic.elements.edges!, nodes, myNode);

    // Then, process traffic going/originating to/from workloads|apps
    const { inboundTraffic: workloadsInbound, outboundTraffic: workloadsOutbound } = this.processTrafficSiblings(
      traffic.elements.edges,
      serviceTraffic,
      nodes,
      myNode
    );

    // Merge and set resolved traffic
    const inboundTraffic = servicesInbound.concat(workloadsInbound);
    const outboundTraffic = servicesOutbound.concat(workloadsOutbound);
    this.setState({ inboundTraffic, outboundTraffic });
  };
}

export default TrafficDetails;
