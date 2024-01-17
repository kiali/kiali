import * as React from 'react';
import { Card, CardBody, Grid, GridItem, Toolbar, ToolbarGroup, ToolbarItem } from '@patternfly/react-core';
import * as AlertUtils from '../../utils/AlertUtils';
import {
  GraphDefinition,
  GraphEdgeWrapper,
  GraphNodeData,
  NodeType,
  DestService,
  ProtocolTraffic,
  SEInfo
} from '../../types/Graph';
import { RenderComponentScroll } from '../Nav/Page';
import { MetricsObjectTypes } from '../../types/Metrics';
import { GraphDataSource } from 'services/GraphDataSource';
import { DurationInSeconds, TimeInMilliseconds } from 'types/Common';
import * as FilterHelper from '../FilterList/FilterHelper';
import * as TrafficListFilters from './FiltersAndSorts';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { durationSelector } from '../../store/Selectors';
import { HealthAnnotationType } from '../../types/HealthAnnotation';
import { TrafficListComponent } from 'components/TrafficList/TrafficListComponent';
import { KioskElement } from '../Kiosk/KioskElement';
import { TimeDurationModal } from '../Time/TimeDurationModal';
import { TimeDurationIndicator } from '../Time/TimeDurationIndicator';

export interface AppNode {
  id: string;
  type: NodeType.APP;
  namespace: string;
  name: string;
  version: string;
  isInaccessible: boolean;
  cluster?: string;
}

export interface WorkloadNode {
  id: string;
  type: NodeType.WORKLOAD;
  namespace: string;
  name: string;
  isInaccessible: boolean;
  healthAnnotation?: HealthAnnotationType;
  cluster?: string;
}

export interface ServiceNode {
  id: string;
  type: NodeType.SERVICE;
  namespace: string;
  name: string;
  isInaccessible: boolean;
  isServiceEntry?: SEInfo;
  destServices?: DestService[];
  healthAnnotation?: HealthAnnotationType;
  cluster?: string;
}

export type TrafficNode = AppNode | ServiceNode | WorkloadNode;

export type TrafficDirection = 'inbound' | 'outbound';

export interface TrafficItem {
  direction: TrafficDirection;
  node: TrafficNode;
  proxy?: TrafficItem;
  traffic: ProtocolTraffic;
  mTLS?: number;
}

type ReduxProps = {
  duration: DurationInSeconds;
};

type TrafficDetailsProps = ReduxProps & {
  itemName: string;
  itemType: MetricsObjectTypes;
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
  cluster?: string;
};

type TrafficDetailsState = {
  isTimeOptionsOpen: boolean;
  traffic: TrafficItem[];
};

class TrafficDetailsComponent extends React.Component<TrafficDetailsProps, TrafficDetailsState> {
  private graphDataSource = new GraphDataSource();

  constructor(props: TrafficDetailsProps) {
    super(props);
    this.state = {
      isTimeOptionsOpen: false,
      traffic: []
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
    const durationChanged = prevProps.duration !== this.props.duration;
    const itemNameChanged = prevProps.itemName !== this.props.itemName;
    const itemTypeChanged = prevProps.itemType !== this.props.itemType;
    const namespaceChanged = prevProps.namespace !== this.props.namespace;
    const refreshChanged = prevProps.lastRefreshAt !== this.props.lastRefreshAt;

    if (durationChanged || itemNameChanged || itemTypeChanged || namespaceChanged || refreshChanged) {
      this.fetchDataSource();
    }
  }

  render() {
    return (
      <>
        <RenderComponentScroll>
          <Grid>
            <GridItem span={12}>
              <Card>
                <CardBody>
                  <Toolbar style={{ padding: 0, width: '100%' }}>
                    <ToolbarGroup>
                      <KioskElement>
                        <ToolbarItem style={{ marginLeft: 'auto' }}>
                          <TimeDurationIndicator isDuration={true} onClick={this.toggleTimeOptionsVisibility} />
                        </ToolbarItem>
                      </KioskElement>
                    </ToolbarGroup>
                  </Toolbar>
                  <TrafficListComponent
                    currentSortField={FilterHelper.currentSortField(TrafficListFilters.sortFields)}
                    isSortAscending={FilterHelper.isCurrentSortAscending()}
                    trafficItems={this.state.traffic}
                  />
                </CardBody>
              </Card>
            </GridItem>
          </Grid>
        </RenderComponentScroll>
        <TimeDurationModal
          customDuration={false}
          isOpen={this.state.isTimeOptionsOpen}
          onConfirm={this.toggleTimeOptionsVisibility}
          onCancel={this.toggleTimeOptionsVisibility}
        />
      </>
    );
  }

  private fetchDataSource = () => {
    switch (this.props.itemType) {
      case MetricsObjectTypes.SERVICE: {
        const params = this.graphDataSource.fetchForServiceParams(
          this.props.duration,
          this.props.namespace,
          this.props.itemName,
          this.props.cluster
        );
        params.includeHealth = false;
        params.showSecurity = true;
        this.graphDataSource.fetchGraphData(params);
        break;
      }
      case MetricsObjectTypes.WORKLOAD: {
        const params = this.graphDataSource.fetchForWorkloadParams(
          this.props.duration,
          this.props.namespace,
          this.props.itemName,
          this.props.cluster
        );
        params.includeHealth = false;
        params.injectServiceNodes = false;
        params.showSecurity = true;
        this.graphDataSource.fetchGraphData(params);
        break;
      }
      case MetricsObjectTypes.APP: {
        const params = this.graphDataSource.fetchForAppParams(
          this.props.duration,
          this.props.namespace,
          this.props.itemName,
          this.props.cluster
        );
        params.includeHealth = false;
        params.injectServiceNodes = false;
        params.showSecurity = true;
        this.graphDataSource.fetchGraphData(params);
        break;
      }
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

  private buildTrafficNode = (prefix: 'in' | 'out', node: GraphNodeData): TrafficNode => {
    // given restrictions on fetch options the node type should be either App, Workload or [outbound] service
    switch (node.nodeType) {
      case NodeType.APP:
        return {
          id: `${prefix}-${node.id}`,
          type: node.nodeType,
          namespace: node.namespace,
          cluster: node.cluster,
          name: node.app || 'unknown',
          version: node.version || '',
          isInaccessible: node.isInaccessible || false
        };
      case NodeType.SERVICE:
        return {
          id: `${prefix}-${node.id}`,
          type: node.nodeType,
          namespace: node.namespace,
          cluster: node.cluster,
          name: node.service || 'unknown',
          isServiceEntry: node.isServiceEntry,
          isInaccessible: node.isInaccessible || false,
          destServices: node.destServices,
          healthAnnotation: node.hasHealthConfig
        };
      default:
        return {
          id: `${prefix}-${node.id}`,
          type: NodeType.WORKLOAD,
          namespace: node.namespace,
          cluster: node.cluster,
          name: node.workload || 'unknown',
          isInaccessible: node.isInaccessible || false,
          healthAnnotation: node.hasHealthConfig
        };
    }
  };

  private processTraffic = (
    edges: GraphEdgeWrapper[],
    nodes: { [key: string]: GraphNodeData },
    myNode: GraphNodeData
  ) => {
    const traffic: TrafficItem[] = [];

    edges.forEach(edge => {
      const sourceNode = nodes['id-' + edge.data.source];
      const targetNode = nodes['id-' + edge.data.target];
      if (myNode.id === edge.data.source) {
        const trafficItem: TrafficItem = {
          direction: 'outbound',
          node: this.buildTrafficNode('out', targetNode),
          traffic: edge.data.traffic!,
          mTLS: edge.data.isMTLS
        };
        traffic.push(trafficItem);
      } else if (myNode.id === edge.data.target) {
        const trafficItem: TrafficItem = {
          direction: 'inbound',
          node: this.buildTrafficNode('in', sourceNode),
          traffic: edge.data.traffic!,
          mTLS: edge.data.isMTLS
        };
        traffic.push(trafficItem);
      }
    });

    return { traffic: traffic };
  };

  private processTrafficData = (traffic: GraphDefinition | null) => {
    if (
      !traffic ||
      !traffic.elements.nodes ||
      !traffic.elements.edges ||
      traffic.elements.nodes.length === 0 ||
      traffic.elements.edges.length === 0
    ) {
      this.setState({ traffic: [] });
      return;
    }

    // Index nodes by id and find the node of the queried item
    const nodes: { [key: string]: GraphNodeData } = {};
    let myNode: GraphNodeData = { id: '', nodeType: NodeType.UNKNOWN, cluster: '', namespace: '' };

    traffic.elements.nodes.forEach(element => {
      // Ignore box nodes. They are not relevant for the traffic list because we
      // are interested in the actual apps.
      if (!element.data.isBox) {
        nodes['id-' + element.data.id] = element.data;
        if (element.data.namespace) {
          const isMyWorkload =
            this.props.itemType === MetricsObjectTypes.WORKLOAD &&
            element.data.nodeType === NodeType.WORKLOAD &&
            this.props.itemName === element.data.workload;
          const isMyApp =
            this.props.itemType === MetricsObjectTypes.APP &&
            element.data.nodeType === NodeType.APP &&
            this.props.itemName === element.data.app;
          const isMyService =
            this.props.itemType === MetricsObjectTypes.SERVICE &&
            element.data.nodeType === NodeType.SERVICE &&
            this.props.itemName === element.data.service;

          if (isMyWorkload || isMyApp || isMyService) {
            myNode = element.data;
          }
        }
      }
    });

    if (myNode.id === '') {
      // Graph endpoint didn't return a graph for the current node.
      this.setState({ traffic: [] });
      return;
    }

    // Process the direct inbound/outbound traffic to/from the item of interest.
    this.setState(this.processTraffic(traffic.elements.edges!, nodes, myNode));
  };

  private toggleTimeOptionsVisibility = () => {
    this.setState(prevState => ({ isTimeOptionsOpen: !prevState.isTimeOptionsOpen }));
  };
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    duration: durationSelector(state)
  };
};

export const TrafficDetails = connect(mapStateToProps)(TrafficDetailsComponent);
