import * as React from 'react';
import {
  Card,
  CardActions,
  CardBody,
  CardHeader,
  CardTitle,
  Dropdown,
  DropdownItem,
  KebabToggle
} from '@patternfly/react-core';
import history from '../../app/History';
import GraphDataSource from '../../services/GraphDataSource';
import { DecoratedGraphElements, EdgeMode, GraphType, NodeType } from '../../types/Graph';
import CytoscapeGraph, { GraphEdgeTapEvent, GraphNodeTapEvent } from './CytoscapeGraph';
import { CytoscapeGraphSelectorBuilder } from './CytoscapeGraphSelector';
import { GraphUrlParams, makeNodeGraphUrlFromParams } from 'components/Nav/NavUtils';
import { store } from 'store/ConfigStore';
import { style } from 'typestyle';
import { toRangeString } from '../Time/Utils';
import { TimeInMilliseconds } from '../../types/Common';
import { KialiDagreGraph } from './graphs/KialiDagreGraph';

const initGraphContainerStyle = style({ width: '100%', height: '100%' });

type MiniGraphCardProps = {
  dataSource: GraphDataSource;
  graphContainerStyle?: string;
  mtlsEnabled: boolean;
  onEdgeTap?: (e: GraphEdgeTapEvent) => void;
};

type MiniGraphCardState = {
  isKebabOpen: boolean;
  graphData: DecoratedGraphElements;
};

export default class MiniGraphCard extends React.Component<MiniGraphCardProps, MiniGraphCardState> {
  private cytoscapeGraphRef: any;

  constructor(props) {
    super(props);
    this.cytoscapeGraphRef = React.createRef();
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
    const rangeEnd: TimeInMilliseconds = this.props.dataSource.graphTimestamp * 1000;
    const rangeStart: TimeInMilliseconds = rangeEnd - this.props.dataSource.graphDuration * 1000;
    const intervalTitle =
      rangeEnd > 0 ? toRangeString(rangeStart, rangeEnd, { second: '2-digit' }, { second: '2-digit' }) : 'Loading';

    return (
      <Card style={{ height: '100%' }} id={'MiniGraphCard'} data-test="mini-graph">
        <CardHeader>
          <CardActions>
            <Dropdown
              toggle={<KebabToggle onToggle={this.onGraphActionsToggle} />}
              dropdownItems={graphCardActions}
              isPlain
              isOpen={this.state.isKebabOpen}
              position={'right'}
            />
          </CardActions>
          <CardTitle style={{ float: 'left' }}>{intervalTitle}</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ height: '100%' }}>
            <CytoscapeGraph
              compressOnHide={true}
              containerClassName={
                this.props.graphContainerStyle ? this.props.graphContainerStyle : initGraphContainerStyle
              }
              graphData={{
                elements: this.state.graphData,
                elementsChanged: true,
                errorMessage: !!this.props.dataSource.errorMessage ? this.props.dataSource.errorMessage : undefined,
                isError: this.props.dataSource.isError,
                isLoading: this.props.dataSource.isLoading,
                fetchParams: this.props.dataSource.fetchParameters,
                timestamp: this.props.dataSource.graphTimestamp
              }}
              toggleIdleNodes={() => undefined}
              edgeLabels={this.props.dataSource.fetchParameters.edgeLabels}
              edgeMode={EdgeMode.ALL}
              isMTLSEnabled={this.props.mtlsEnabled}
              isMiniGraph={true}
              onEdgeTap={this.props.onEdgeTap}
              layout={KialiDagreGraph.getLayout()}
              namespaceLayout={KialiDagreGraph.getLayout()}
              onNodeTap={this.handleNodeTap}
              // Ranking not enabled for minigraphs yet
              rankBy={[]}
              ref={refInstance => this.setCytoscapeGraph(refInstance)}
              refreshInterval={0}
              setRankResult={undefined}
              showIdleEdges={false}
              showMissingSidecars={true}
              showOperationNodes={false}
              showRank={false}
              showSecurity={true}
              showServiceNodes={true}
              showTrafficAnimation={false}
              showIdleNodes={false}
              showVirtualServices={true}
              summaryData={null}
            />
          </div>
        </CardBody>
      </Card>
    );
  }

  private setCytoscapeGraph(cytoscapeGraph: any) {
    this.cytoscapeGraphRef.current = cytoscapeGraph;
  }

  private handleNodeTap = (e: GraphNodeTapEvent) => {
    // Do nothing on inaccessible nodes or service entry nodes
    if (e.isInaccessible || e.isServiceEntry) {
      return;
    }

    // If we are already on the details page of the tapped node, do nothing.
    const displayedNode = this.props.dataSource.fetchParameters.node;
    // Minigraph will consider box nodes as app
    const eNodeType = e.nodeType === 'box' && e.isBox ? e.isBox : e.workload ? 'workload' : e.nodeType;
    const isSameResource =
      displayedNode?.namespace.name === e.namespace &&
      displayedNode.nodeType === eNodeType &&
      displayedNode[displayedNode.nodeType] === e[eNodeType];

    if (isSameResource) {
      return;
    }

    // unselect the currently selected node
    const cy = this.cytoscapeGraphRef.current.getCy();
    if (cy) {
      cy.$(':selected').selectify().unselect().unselectify();
    }

    // Redirect to the details page of the tapped node.
    let resource = e[eNodeType];
    let resourceType: string = eNodeType === NodeType.APP ? 'application' : eNodeType;

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
      edgeLabels: this.props.dataSource.fetchParameters.edgeLabels,
      edgeMode: EdgeMode.ALL,
      graphLayout: store.getState().graph.layout,
      namespaceLayout: store.getState().graph.namespaceLayout,
      graphType: graphType,
      node: this.props.dataSource.fetchParameters.node!,
      refreshInterval: store.getState().userSettings.refreshInterval,
      showIdleEdges: this.props.dataSource.fetchParameters.showIdleEdges,
      showIdleNodes: this.props.dataSource.fetchParameters.showIdleNodes,
      showOperationNodes: this.props.dataSource.fetchParameters.showOperationNodes,
      showServiceNodes: true,
      trafficRates: this.props.dataSource.fetchParameters.trafficRates
    };

    // To ensure updated components get the updated URL, update the URL first and then the state
    history.push(makeNodeGraphUrlFromParams(urlParams));
  };
}
