import * as React from 'react';
import { Card, CardBody, Grid, GridItem } from '@patternfly/react-core';
import * as AlertUtils from '../../utils/AlertUtils';
import { GraphDefinition, GraphEdgeWrapper, GraphNodeData, NodeType } from '../../types/Graph';
import DetailedTrafficList, { TrafficItem, TrafficNode } from '../Details/DetailedTrafficList';
import { RenderComponentScroll } from '../../components/Nav/Page';
import { MetricsObjectTypes } from '../../types/Metrics';
import { DurationDropdownContainer } from 'components/DurationDropdown/DurationDropdown';
import RefreshButtonContainer from 'components/Refresh/RefreshButton';
import GraphDataSource from 'services/GraphDataSource';
import { DurationInSeconds } from 'types/Common';
import { RightActionBar } from 'components/RightActionBar/RightActionBar';

type AppProps = {
  itemType: MetricsObjectTypes.APP;
  namespace: string;
  appName: string;
};

type ServiceProps = {
  itemType: MetricsObjectTypes.SERVICE;
  namespace: string;
  serviceName: string;
};

type WorkloadProps = {
  itemType: MetricsObjectTypes.WORKLOAD;
  namespace: string;
  workloadName: string;
};

type TrafficDetailsProps = {
  duration: DurationInSeconds;
} & (AppProps | WorkloadProps | ServiceProps);

type TrafficDetailsState = {
  inboundTraffic: TrafficItem[];
  outboundTraffic: TrafficItem[];
};

type ServiceTraffic = {
  [key: string]: TrafficItem;
};

class TrafficDetails extends React.Component<TrafficDetailsProps, TrafficDetailsState> {
  private graphDataSource = new GraphDataSource();

  constructor(props: TrafficDetailsProps) {
    super(props);
    this.state = {
      inboundTraffic: [],
      outboundTraffic: []
    };
  }

  componentDidMount() {
    this.graphDataSource.on('fetchSuccess', this.graphDsFetchSuccess);
    this.graphDataSource.on('fetchError', this.graphDsFetchError);
    this.fetchDataSource();
  }

  componentWillUnmount() {
    this.graphDataSource.removeListener('fetchSuccess', this.graphDsFetchSuccess);
    this.graphDataSource.removeListener('fetchError', this.graphDsFetchError);
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
    const isServiceSet =
      prevProps.itemType === MetricsObjectTypes.SERVICE &&
      this.props.itemType === prevProps.itemType &&
      (prevProps.namespace !== this.props.namespace || prevProps.serviceName !== this.props.serviceName);

    if (isWorkloadSet || isAppSet || isServiceSet || prevProps.duration !== this.props.duration) {
      this.fetchDataSource();
    }
  }

  private fetchDataSource = () => {
    switch (this.props.itemType) {
      case MetricsObjectTypes.SERVICE:
        this.graphDataSource.fetchForService(this.props.duration, this.props.namespace, this.props.serviceName);
        break;
      case MetricsObjectTypes.WORKLOAD:
        this.graphDataSource.fetchForWorkload(this.props.duration, this.props.namespace, this.props.workloadName);
        break;
      case MetricsObjectTypes.APP:
        this.graphDataSource.fetchForApp(this.props.duration, this.props.namespace, this.props.appName);
        break;
    }
  };

  private graphDsFetchSuccess = () => {
    this.processTrafficData(this.graphDataSource.graphDefinition);
  };

  private graphDsFetchError = (errorMessage: string | null) => {
    if (errorMessage !== '') {
      errorMessage = 'Could not fetch traffic data: ' + errorMessage;
    } else {
      errorMessage = 'Could not fetch traffic data.';
    }

    AlertUtils.addError(errorMessage);
  };

  render() {
    return (
      <>
        <RightActionBar>
          <DurationDropdownContainer id="service-traffic-duration-dropdown" prefix="Last" />
          <RefreshButtonContainer handleRefresh={this.fetchDataSource} />
        </RightActionBar>
        <RenderComponentScroll>
          <Grid style={{ padding: '10px' }}>
            <GridItem span={12}>
              <Card>
                <CardBody>
                  <DetailedTrafficList header="Inbound" direction="inbound" traffic={this.state.inboundTraffic} />
                  <div style={{ marginTop: '2em' }} />
                  <DetailedTrafficList header="Outbound" direction="outbound" traffic={this.state.outboundTraffic} />
                </CardBody>
              </Card>
            </GridItem>
          </Grid>
        </RenderComponentScroll>
      </>
    );
  }

  private buildTrafficNode = (prefix: 'in' | 'out', node: GraphNodeData): TrafficNode => {
    switch (node.nodeType) {
      case NodeType.WORKLOAD:
        return {
          id: `${prefix}-${node.id}`,
          type: node.nodeType,
          namespace: node.namespace,
          name: node.workload || 'unknown',
          isInaccessible: node.isInaccessible || false
        };
      case NodeType.APP:
        return {
          id: `${prefix}-${node.id}`,
          type: node.nodeType,
          namespace: node.namespace,
          name: node.app || 'unknown',
          version: node.version || '',
          isInaccessible: node.isInaccessible || false
        };
      case NodeType.SERVICE:
        return {
          id: `${prefix}-${node.id}`,
          type: node.nodeType,
          namespace: node.namespace,
          name: node.service || 'unknown',
          isServiceEntry: node.isServiceEntry,
          isInaccessible: node.isInaccessible || false,
          destServices: node.destServices
        };
      default:
        return {
          id: `${prefix}-${node.id}`,
          type: NodeType.UNKNOWN,
          namespace: node.namespace,
          name: 'unknown'
        };
    }
  };

  private processSecondLevelTraffic = (
    edges: any,
    serviceTraffic: ServiceTraffic,
    nodes: { [key: string]: GraphNodeData },
    myNode: GraphNodeData
  ) => {
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

  private processFirstLevelTraffic = (
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
      if (myNode.id === edge.data.source) {
        const trafficItem: TrafficItem = {
          traffic: edge.data.traffic!,
          node: this.buildTrafficNode('out', targetNode)
        };
        outboundTraffic.push(trafficItem);

        if (trafficItem.node.type === NodeType.SERVICE) {
          const svcId = `out-${trafficItem.node.namespace}-${trafficItem.node.name}`;
          if (!serviceTraffic[svcId]) {
            serviceTraffic[svcId] = trafficItem;
          }
        }
      } else if (myNode.id === edge.data.target) {
        const trafficItem: TrafficItem = {
          traffic: edge.data.traffic!,
          node: this.buildTrafficNode('in', sourceNode)
        };
        inboundTraffic.push(trafficItem);

        if (trafficItem.node.type === NodeType.SERVICE) {
          const svcId = `in-${trafficItem.node.namespace}-${trafficItem.node.name}`;
          if (!serviceTraffic[svcId]) {
            serviceTraffic[svcId] = trafficItem;
          }
        }
      }
    });

    return { serviceTraffic, inboundTraffic, outboundTraffic };
  };

  private processTrafficData = (traffic: GraphDefinition | null) => {
    if (
      !traffic ||
      !traffic.elements.nodes ||
      !traffic.elements.edges ||
      traffic.elements.nodes.length === 0 ||
      traffic.elements.edges.length === 0
    ) {
      this.setState({ inboundTraffic: [], outboundTraffic: [] });
      return;
    }

    // Index nodes by id and find the node of the queried item
    const nodes: { [key: string]: GraphNodeData } = {};
    let myNode: GraphNodeData = { id: '', nodeType: NodeType.UNKNOWN, namespace: '' };

    traffic.elements.nodes.forEach(element => {
      // Ignore group nodes. They are not relevant for the traffic list because we
      // are interested in the actual apps.
      if (!element.data.isGroup) {
        nodes['id-' + element.data.id] = element.data;
        if (element.data.namespace) {
          const isMyWorkload =
            this.props.itemType === MetricsObjectTypes.WORKLOAD &&
            element.data.nodeType === NodeType.WORKLOAD &&
            this.props.workloadName === element.data.workload;
          const isMyApp =
            this.props.itemType === MetricsObjectTypes.APP &&
            element.data.nodeType === NodeType.APP &&
            this.props.appName === element.data.app;
          const isMyService =
            this.props.itemType === MetricsObjectTypes.SERVICE &&
            element.data.nodeType === NodeType.SERVICE &&
            this.props.serviceName === element.data.service;

          if (isMyWorkload || isMyApp || isMyService) {
            myNode = element.data;
          }
        }
      }
    });

    if (myNode.id === '') {
      // Graph endpoint didn't return a graph for the current node.
      this.setState({ inboundTraffic: [], outboundTraffic: [] });
      return;
    }

    // Process direct traffic to/from the item of interest.
    // This finds services and direct traffic (like workload-to-workload traffic)
    const {
      serviceTraffic,
      inboundTraffic: firstLevelInbound,
      outboundTraffic: firstLevelOutbound
    } = this.processFirstLevelTraffic(traffic.elements.edges!, nodes, myNode);

    // Then, process second level traffic.
    // Second level are nodes whose traffic go through services and reaches
    // the entity of interest.
    const { inboundTraffic: secondLevelInbound, outboundTraffic: secondLevelOutbound } = this.processSecondLevelTraffic(
      traffic.elements.edges,
      serviceTraffic,
      nodes,
      myNode
    );

    // Merge and set resolved traffic
    const inboundTraffic = firstLevelInbound.concat(secondLevelInbound);
    const outboundTraffic = firstLevelOutbound.concat(secondLevelOutbound);
    this.setState({ inboundTraffic, outboundTraffic });
  };
}

export default TrafficDetails;
