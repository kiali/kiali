import * as React from 'react';
import { style } from 'typestyle';
import {
  Card,
  CardActions,
  CardBody,
  CardHead,
  CardHeader,
  Dropdown,
  DropdownItem,
  KebabToggle,
  Title
} from '@patternfly/react-core';
import history from '../../app/History';
import GraphDataSource from '../../services/GraphDataSource';
import { DecoratedGraphElements, EdgeLabelMode, GraphType, NodeType } from '../../types/Graph';
import CytoscapeGraph, { GraphNodeDoubleTapEvent } from './CytoscapeGraph';
import { CytoscapeGraphSelectorBuilder } from './CytoscapeGraphSelector';
import { DagreGraph } from './graphs/DagreGraph';
import { GraphUrlParams, makeNodeGraphUrlFromParams } from 'components/Nav/NavUtils';
import { store } from 'store/ConfigStore';

const miniGraphContainerStyle = style({ height: '300px' });

type MiniGraphCardProps = {
  dataSource: GraphDataSource;
};

type MiniGraphCardState = {
  isKebabOpen: boolean;
  graphData: DecoratedGraphElements;
};

export default class MiniGraphCard extends React.Component<MiniGraphCardProps, MiniGraphCardState> {
  constructor(props) {
    super(props);
    this.state = { isKebabOpen: false, graphData: props.dataSource.graphData };
  }

  componentDidMount() {
    this.props.dataSource.on('fetchSuccess', this.refresh);
    this.props.dataSource.on('fetchError', this.refresh);
  }

  componentWillUnmount() {
    this.props.dataSource.removeListener('fetchSuccess', this.refresh);
    this.props.dataSource.removeListener('fetchError', this.refresh);
  }

  private refresh = () => {
    this.setState({ graphData: this.props.dataSource.graphData });
  };

  render() {
    const graphCardActions = [
      <DropdownItem key="viewFullGraph" onClick={this.onViewFullGraph}>
        Show full graph
      </DropdownItem>,
      <DropdownItem key="viewNodeGraph" onClick={this.onViewNodeGraph}>
        Show node graph
      </DropdownItem>
    ];

    return (
      <Card style={{ height: '100%' }}>
        <CardHead>
          <CardActions>
            <Dropdown
              toggle={<KebabToggle onToggle={this.onGraphActionsToggle} />}
              dropdownItems={graphCardActions}
              isPlain
              isOpen={this.state.isKebabOpen}
              position={'right'}
            />
          </CardActions>
          <CardHeader>
            <Title style={{ float: 'left' }} headingLevel="h3" size="2xl">
              Graph Overview
            </Title>
          </CardHeader>
        </CardHead>
        <CardBody>
          <div style={{ height: '100%' }}>
            <CytoscapeGraph
              boxByCluster={false}
              boxByNamespace={false}
              compressOnHide={true}
              containerClassName={miniGraphContainerStyle}
              graphData={{
                elements: this.state.graphData,
                errorMessage: !!this.props.dataSource.errorMessage ? this.props.dataSource.errorMessage : undefined,
                isError: this.props.dataSource.isError,
                isLoading: this.props.dataSource.isLoading,
                fetchParams: this.props.dataSource.fetchParameters,
                timestamp: this.props.dataSource.graphTimestamp
              }}
              toggleIdleNodes={() => undefined}
              edgeLabelMode={EdgeLabelMode.NONE}
              isMTLSEnabled={false}
              isMiniGraph={true}
              layout={DagreGraph.getLayout()}
              onNodeTap={this.handleNodeTap}
              refreshInterval={0}
              showCircuitBreakers={false}
              showIdleEdges={false}
              showMissingSidecars={true}
              showOperationNodes={false}
              showSecurity={false}
              showServiceNodes={true}
              showTrafficAnimation={false}
              showIdleNodes={false}
              showVirtualServices={true}
            />
          </div>
        </CardBody>
      </Card>
    );
  }

  private handleNodeTap = (e: GraphNodeDoubleTapEvent) => {
    // Do nothing on inaccessible nodes or service entry nodes
    if (e.isInaccessible || e.isServiceEntry) {
      return;
    }

    // If we are already on the details page of the double-tapped node, do nothing.
    const displayedNode = this.props.dataSource.fetchParameters.node;
    const isSameResource =
      displayedNode?.namespace.name === e.namespace &&
      displayedNode.nodeType === e.nodeType &&
      displayedNode[displayedNode.nodeType] === e[e.nodeType];

    if (isSameResource) {
      return;
    }

    // Redirect to the details page of the double-tapped node.
    let resource = e[e.nodeType];
    let resourceType: string = e.nodeType === NodeType.APP ? 'application' : e.nodeType;

    history.push(`/namespaces/${e.namespace}/${resourceType}s/${resource}`);
  };

  private onGraphActionsToggle = (isOpen: boolean) => {
    this.setState({
      isKebabOpen: isOpen
    });
  };

  private onViewFullGraph = () => {
    const namespace = this.props.dataSource.fetchParameters.namespaces[0].name;
    let cytoscapeGraph = new CytoscapeGraphSelectorBuilder().namespace(namespace);
    let graphType: GraphType = GraphType.APP;

    switch (this.props.dataSource.fetchParameters.node!.nodeType) {
      case NodeType.AGGREGATE:
        cytoscapeGraph = cytoscapeGraph
          .aggregate(
            this.props.dataSource.fetchParameters.node!.aggregate!,
            this.props.dataSource.fetchParameters.node!.aggregateValue!
          )
          .nodeType(NodeType.AGGREGATE);
        break;
      case NodeType.APP:
        cytoscapeGraph = cytoscapeGraph.app(this.props.dataSource.fetchParameters.node!.app).nodeType(NodeType.APP);
        break;
      case NodeType.SERVICE:
        graphType = GraphType.SERVICE;
        cytoscapeGraph = cytoscapeGraph.service(this.props.dataSource.fetchParameters.node!.service);
        break;
      case NodeType.WORKLOAD:
        graphType = GraphType.WORKLOAD;
        cytoscapeGraph = cytoscapeGraph.workload(this.props.dataSource.fetchParameters.node!.workload);
        break;
      default:
        // NodeType.BOX is n/a
        break;
    }

    const graphUrl = `/graph/namespaces?graphType=${graphType}&injectServiceNodes=true&namespaces=${namespace}&focusSelector=${encodeURI(
      cytoscapeGraph.build()
    )}`;

    history.push(graphUrl);
  };

  private onViewNodeGraph = () => {
    let graphType = this.props.dataSource.fetchParameters.graphType;
    switch (this.props.dataSource.fetchParameters.node!.nodeType) {
      case NodeType.APP:
        graphType = GraphType.APP;
        break;
      case NodeType.SERVICE:
        graphType = GraphType.SERVICE;
        break;
      case NodeType.WORKLOAD:
        graphType = GraphType.WORKLOAD;
        break;
    }

    const urlParams: GraphUrlParams = {
      activeNamespaces: this.props.dataSource.fetchParameters.namespaces,
      duration: this.props.dataSource.fetchParameters.duration,
      edgeLabelMode: this.props.dataSource.fetchParameters.edgeLabelMode,
      graphLayout: store.getState().graph.layout,
      graphType: graphType,
      node: this.props.dataSource.fetchParameters.node!,
      refreshInterval: store.getState().userSettings.refreshInterval,
      showIdleEdges: this.props.dataSource.fetchParameters.showIdleEdges,
      showIdleNodes: this.props.dataSource.fetchParameters.showIdleNodes,
      showOperationNodes: this.props.dataSource.fetchParameters.showOperationNodes,
      showServiceNodes: true
    };

    // To ensure updated components get the updated URL, update the URL first and then the state
    history.push(makeNodeGraphUrlFromParams(urlParams));
  };
}
