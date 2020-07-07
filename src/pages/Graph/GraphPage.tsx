import * as Cy from 'cytoscape';
import * as React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { RouteComponentProps } from 'react-router-dom';
import FlexView from 'react-flexview';
import { style } from 'typestyle';
import history from '../../app/History';
import { store } from '../../store/ConfigStore';
import { DurationInSeconds, IntervalInMilliseconds, TimeInMilliseconds, TimeInSeconds } from '../../types/Common';
import { MessageType } from '../../types/MessageCenter';
import Namespace from '../../types/Namespace';
import {
  CytoscapeClickEvent,
  DecoratedGraphElements,
  EdgeLabelMode,
  GraphDefinition,
  GraphType,
  Layout,
  NodeParamsType,
  NodeType,
  SummaryData,
  UNKNOWN
} from '../../types/Graph';
import { computePrometheusRateParams } from '../../services/Prometheus';
import * as AlertUtils from '../../utils/AlertUtils';
import CytoscapeGraph, { GraphNodeDoubleTapEvent } from '../../components/CytoscapeGraph/CytoscapeGraph';
import CytoscapeToolbarContainer from '../../components/CytoscapeGraph/CytoscapeToolbar';
import ErrorBoundary from '../../components/ErrorBoundary/ErrorBoundary';
import { GraphUrlParams, makeNodeGraphUrlFromParams } from '../../components/Nav/NavUtils';
import GraphToolbarContainer from './GraphToolbar/GraphToolbar';
import GraphLegend from './GraphLegend';
import EmptyGraphLayout from '../../components/CytoscapeGraph/EmptyGraphLayout';
import SummaryPanel from './SummaryPanel';
import {
  activeNamespacesSelector,
  durationSelector,
  edgeLabelModeSelector,
  graphTypeSelector,
  lastRefreshAtSelector,
  meshWideMTLSEnabledSelector,
  refreshIntervalSelector,
  replayActiveSelector,
  replayQueryTimeSelector
} from '../../store/Selectors';
import { KialiAppState } from '../../store/Store';
import { KialiAppAction } from '../../actions/KialiAppAction';
import { GraphActions } from '../../actions/GraphActions';
import { GraphToolbarActions } from '../../actions/GraphToolbarActions';
import { NodeContextMenuContainer } from '../../components/CytoscapeGraph/ContextMenu/NodeContextMenu';
import { PfColors, PFKialiColor } from 'components/Pf/PfColors';
import { TourActions } from 'actions/TourActions';
import TourStopContainer, { getNextTourStop, TourInfo } from 'components/Tour/TourStop';
import { arrayEquals } from 'utils/Common';
import { isKioskMode, getFocusSelector, unsetFocusSelector, getTraceId } from 'utils/SearchParamUtils';
import GraphTour, { GraphTourStops } from './GraphHelpTour';
import { Badge, Chip } from '@patternfly/react-core';
import { toRangeString } from 'components/Time/Utils';
import { replayBorder } from 'components/Time/Replay';
import GraphDataSource, { FetchParams, EMPTY_GRAPH_DATA } from '../../services/GraphDataSource';
import { NamespaceActions } from '../../actions/NamespaceAction';
import GraphThunkActions from '../../actions/GraphThunkActions';
import { JaegerTrace } from 'types/JaegerInfo';
import { JaegerThunkActions } from 'actions/JaegerThunkActions';

// GraphURLPathProps holds path variable values.  Currenly all path variables are relevant only to a node graph
type GraphURLPathProps = {
  app: string;
  namespace: string;
  service: string;
  version: string;
  workload: string;
};

type ReduxProps = {
  activeNamespaces: Namespace[];
  activeTour?: TourInfo;
  compressOnHide: boolean;
  displayUnusedNodes: () => void;
  duration: DurationInSeconds; // current duration (dropdown) setting
  edgeLabelMode: EdgeLabelMode;
  graphType: GraphType;
  isPageVisible: boolean;
  lastRefreshAt: TimeInMilliseconds;
  layout: Layout;
  node?: NodeParamsType;
  onReady: (cytoscapeRef: any) => void;
  refreshInterval: IntervalInMilliseconds;
  replayActive: boolean;
  replayQueryTime: TimeInMilliseconds;
  setActiveNamespaces: (namespace: Namespace[]) => void;
  setGraphDefinition: (graphDefinition: GraphDefinition) => void;
  setTraceId: (traceId?: string) => void;
  setUpdateTime: (val: TimeInMilliseconds) => void;
  showCircuitBreakers: boolean;
  showLegend: boolean;
  showMissingSidecars: boolean;
  showNodeLabels: boolean;
  showOperationNodes: boolean;
  showSecurity: boolean;
  showServiceNodes: boolean;
  showTrafficAnimation: boolean;
  showUnusedNodes: boolean;
  showVirtualServices: boolean;
  summaryData: SummaryData | null;
  trace?: JaegerTrace;
  updateSummary: (event: CytoscapeClickEvent) => void;
  mtlsEnabled: boolean;

  onNamespaceChange: () => void;
  setNode: (node?: NodeParamsType) => void;
  toggleLegend: () => void;
  endTour: () => void;
  startTour: ({ info: TourInfo, stop: number }) => void;
};

export type GraphPageProps = RouteComponentProps<Partial<GraphURLPathProps>> & ReduxProps;

export type GraphData = {
  elements: DecoratedGraphElements;
  errorMessage?: string;
  fetchParams: FetchParams;
  isLoading: boolean;
  isError?: boolean;
  timestamp: TimeInMilliseconds;
};

type GraphPageState = {
  graphData: GraphData;
};

const NUMBER_OF_DATAPOINTS = 30;

const containerStyle = style({
  minHeight: '350px',
  // TODO: try flexbox to remove this calc
  height: 'calc(100vh - 113px)' // View height minus top bar height minus secondary masthead
});

const kioskContainerStyle = style({
  minHeight: '350px',
  height: 'calc(100vh - 10px)' // View height minus top bar height
});

const cytoscapeGraphContainerStyle = style({ flex: '1', minWidth: '350px', zIndex: 0, paddingRight: '5px' });
const cytoscapeGraphWrapperDivStyle = style({ position: 'relative', backgroundColor: PfColors.GrayBackground });
const cytoscapeToolbarWrapperDivStyle = style({
  position: 'absolute',
  bottom: '10px',
  zIndex: 2,
  borderStyle: 'hidden'
});

const graphTimeRangeDivStyle = style({
  position: 'absolute',
  top: '10px',
  left: '10px',
  width: 'auto',
  zIndex: 2,
  backgroundColor: PfColors.White
});

const whiteBackground = style({
  backgroundColor: PfColors.White
});

const replayBackground = style({
  backgroundColor: PFKialiColor.Replay
});

const graphLegendStyle = style({
  right: '0',
  bottom: '10px',
  position: 'absolute',
  overflow: 'hidden'
});

const GraphErrorBoundaryFallback = () => {
  return (
    <div className={cytoscapeGraphContainerStyle}>
      <EmptyGraphLayout
        namespaces={[]}
        isError={true}
        isDisplayingUnusedNodes={false}
        displayUnusedNodes={() => undefined}
        isMiniGraph={false}
      />
    </div>
  );
};

export class GraphPage extends React.Component<GraphPageProps, GraphPageState> {
  private readonly errorBoundaryRef: any;
  private cytoscapeGraphRef: any;
  private focusSelector?: string;
  private graphDataSource: GraphDataSource;

  static getNodeParamsFromProps(props: RouteComponentProps<Partial<GraphURLPathProps>>): NodeParamsType | undefined {
    const app = props.match.params.app;
    const appOk = app && app !== UNKNOWN && app !== 'undefined';
    const namespace = props.match.params.namespace;
    const namespaceOk = namespace && namespace !== UNKNOWN && namespace !== 'undefined';
    const service = props.match.params.service;
    const serviceOk = service && service !== UNKNOWN && service !== 'undefined';
    const workload = props.match.params.workload;
    const workloadOk = workload && workload !== UNKNOWN && workload !== 'undefined';
    if (!appOk && !namespaceOk && !serviceOk && !workloadOk) {
      // @ts-ignore
      return;
    }

    let nodeType;
    let version;
    if (appOk || workloadOk) {
      nodeType = appOk ? NodeType.APP : NodeType.WORKLOAD;
      version = props.match.params.version;
    } else {
      nodeType = NodeType.SERVICE;
      version = '';
    }
    return {
      app: app!,
      namespace: { name: namespace! },
      nodeType: nodeType,
      service: service!,
      version: version,
      workload: workload!
    };
  }

  static isNodeChanged(prevNode?: NodeParamsType, node?: NodeParamsType): boolean {
    if (prevNode === node) {
      return false;
    }
    if ((prevNode && !node) || (!prevNode && node)) {
      return true;
    }
    if (prevNode && node) {
      const nodeAppHasChanged = prevNode.app !== node.app;
      const nodeServiceHasChanged = prevNode.service !== node.service;
      const nodeVersionHasChanged = prevNode.version !== node.version;
      const nodeTypeHasChanged = prevNode.nodeType !== node.nodeType;
      const nodeWorkloadHasChanged = prevNode.workload !== node.workload;
      return (
        nodeAppHasChanged ||
        nodeServiceHasChanged ||
        nodeVersionHasChanged ||
        nodeWorkloadHasChanged ||
        nodeTypeHasChanged
      );
    }
    return false;
  }

  constructor(props: GraphPageProps) {
    super(props);
    this.errorBoundaryRef = React.createRef();
    this.cytoscapeGraphRef = React.createRef();
    this.focusSelector = getFocusSelector();
    // Let URL override current redux state at construction time
    // Note that state updates will not be posted until after the first render
    const urlNode = GraphPage.getNodeParamsFromProps(props);
    if (GraphPage.isNodeChanged(urlNode, props.node)) {
      props.setNode(urlNode);
    }
    const urlTrace = getTraceId();
    if (urlTrace !== props.trace) {
      props.setTraceId(urlTrace);
    }

    this.graphDataSource = new GraphDataSource();

    this.state = {
      graphData: {
        elements: { edges: [], nodes: [] },
        isLoading: true,
        fetchParams: {
          namespaces: props.node ? [props.node.namespace] : props.activeNamespaces,
          duration: props.duration,
          graphType: props.graphType,
          injectServiceNodes: props.showServiceNodes,
          edgeLabelMode: props.edgeLabelMode,
          showOperationNodes: props.showOperationNodes,
          showSecurity: props.showSecurity,
          showUnusedNodes: props.showUnusedNodes,
          node: props.node,
          queryTime: 0
        },
        timestamp: 0
      }
    };
  }

  componentDidMount() {
    // Connect to graph data source updates
    this.graphDataSource.on('loadStart', this.handleGraphDataSourceStart);
    this.graphDataSource.on('fetchError', this.handleGraphDataSourceError);
    this.graphDataSource.on('fetchSuccess', this.handleGraphDataSourceSuccess);
    this.graphDataSource.on('emptyNamespaces', this.handleGraphDataSourceEmpty);

    // This is a special bookmarking case. If the initial URL is for a node graph then
    // defer the graph fetch until the first component update, when the node is set.
    // (note: to avoid direct store access we could parse the URL again, perhaps that
    // is preferable?  We could also move the logic from the constructor, but that
    // would break our pattern of redux/url handling in the components).
    if (!store.getState().graph.node) {
      this.loadGraphDataFromBackend();
    }
  }

  componentDidUpdate(prev: GraphPageProps) {
    // schedule an immediate graph fetch if needed
    const curr = this.props;

    const activeNamespacesChanged = !arrayEquals(
      prev.activeNamespaces,
      curr.activeNamespaces,
      (n1, n2) => n1.name === n2.name
    );

    // Ensure we initialize the graph when there is a change to activeNamespaces.
    if (activeNamespacesChanged) {
      this.props.onNamespaceChange();
    }

    if (
      activeNamespacesChanged ||
      prev.duration !== curr.duration ||
      (prev.edgeLabelMode !== curr.edgeLabelMode &&
        curr.edgeLabelMode === EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE) ||
      prev.graphType !== curr.graphType ||
      (prev.lastRefreshAt !== curr.lastRefreshAt && curr.replayQueryTime === 0) ||
      prev.replayQueryTime !== curr.replayQueryTime ||
      prev.showOperationNodes !== curr.showOperationNodes ||
      prev.showServiceNodes !== curr.showServiceNodes ||
      prev.showSecurity !== curr.showSecurity ||
      prev.showUnusedNodes !== curr.showUnusedNodes ||
      GraphPage.isNodeChanged(prev.node, curr.node)
    ) {
      this.loadGraphDataFromBackend();
    }

    if (!!this.focusSelector) {
      this.focusSelector = undefined;
      unsetFocusSelector();
    }

    if (prev.layout.name !== curr.layout.name || activeNamespacesChanged) {
      this.errorBoundaryRef.current.cleanError();
    }

    if (curr.showLegend && this.props.activeTour) {
      this.props.endTour();
    }
  }

  componentWillUnmount() {
    // Disconnect from graph data source updates
    this.graphDataSource.removeListener('loadStart', this.handleGraphDataSourceStart);
    this.graphDataSource.removeListener('fetchError', this.handleGraphDataSourceError);
    this.graphDataSource.removeListener('fetchSuccess', this.handleGraphDataSourceSuccess);
    this.graphDataSource.removeListener('emptyNamespaces', this.handleGraphDataSourceEmpty);
  }

  render() {
    let conStyle = containerStyle;
    if (isKioskMode()) {
      conStyle = kioskContainerStyle;
    }
    const isEmpty = !(
      this.state.graphData.elements.nodes && Object.keys(this.state.graphData.elements.nodes).length > 0
    );
    const isReady = !(isEmpty || this.state.graphData.isError);
    const isReplayReady = this.props.replayActive && !!this.props.replayQueryTime;
    const cy = this.cytoscapeGraphRef && this.cytoscapeGraphRef.current ? this.cytoscapeGraphRef.current.getCy() : null;
    return (
      <>
        <FlexView className={conStyle} column={true}>
          <div>
            <GraphToolbarContainer cy={cy} disabled={this.state.graphData.isLoading} onToggleHelp={this.toggleHelp} />
          </div>
          <FlexView
            grow={true}
            className={`${cytoscapeGraphWrapperDivStyle} ${this.props.replayActive && replayBorder}`}
          >
            <ErrorBoundary
              ref={this.errorBoundaryRef}
              onError={this.notifyError}
              fallBackComponent={<GraphErrorBoundaryFallback />}
            >
              {this.props.showLegend && (
                <GraphLegend
                  className={graphLegendStyle}
                  isMTLSEnabled={this.props.mtlsEnabled}
                  closeLegend={this.props.toggleLegend}
                />
              )}
              {isReady && (
                <Chip
                  className={`${graphTimeRangeDivStyle} ${
                    this.props.replayActive ? replayBackground : whiteBackground
                  }`}
                  isOverflowChip={true}
                  isReadOnly={true}
                >
                  {this.props.replayActive && <Badge style={{ marginRight: '4px' }} isRead={true}>{`Replay`}</Badge>}
                  {!isReplayReady && this.props.replayActive && `click Play to start`}
                  {!isReplayReady && !this.props.replayActive && `${this.displayTimeRange()}`}
                  {isReplayReady && `${this.displayTimeRange()}`}
                </Chip>
              )}
              {(!this.props.replayActive || isReplayReady) && (
                <TourStopContainer info={GraphTourStops.Graph}>
                  <TourStopContainer info={GraphTourStops.ContextualMenu}>
                    <CytoscapeGraph
                      containerClassName={cytoscapeGraphContainerStyle}
                      contextMenuGroupComponent={NodeContextMenuContainer}
                      contextMenuNodeComponent={NodeContextMenuContainer}
                      focusSelector={this.focusSelector}
                      graphData={this.state.graphData}
                      isMTLSEnabled={this.props.mtlsEnabled}
                      onEmptyGraphAction={this.handleEmptyGraphAction}
                      onNodeDoubleTap={this.handleDoubleTap}
                      ref={refInstance => this.setCytoscapeGraph(refInstance)}
                      {...this.props}
                    />
                  </TourStopContainer>
                </TourStopContainer>
              )}
              {isReady && (
                <div className={cytoscapeToolbarWrapperDivStyle}>
                  <CytoscapeToolbarContainer cytoscapeGraphRef={this.cytoscapeGraphRef} />
                </div>
              )}
            </ErrorBoundary>
            {this.props.summaryData && (
              <SummaryPanel
                data={this.props.summaryData}
                namespaces={this.props.activeNamespaces}
                graphType={this.props.graphType}
                injectServiceNodes={this.props.showServiceNodes}
                queryTime={this.state.graphData.timestamp / 1000}
                duration={this.state.graphData.fetchParams.duration}
                isPageVisible={this.props.isPageVisible}
                {...computePrometheusRateParams(this.props.duration, NUMBER_OF_DATAPOINTS)}
              />
            )}
          </FlexView>
        </FlexView>
      </>
    );
  }

  private handleEmptyGraphAction = () => {
    this.loadGraphDataFromBackend();
  };

  private handleGraphDataSourceSuccess = (
    graphTimestamp: TimeInSeconds,
    _,
    elements: DecoratedGraphElements,
    fetchParams: FetchParams
  ) => {
    this.setState({
      graphData: {
        elements: elements,
        isLoading: false,
        fetchParams: fetchParams,
        timestamp: graphTimestamp * 1000
      }
    });
    this.props.setGraphDefinition(this.graphDataSource.graphDefinition);
  };

  private handleGraphDataSourceError = (errorMessage: string | null, fetchParams: FetchParams) => {
    this.setState({
      graphData: {
        elements: { edges: [], nodes: [] },
        errorMessage: !!errorMessage ? errorMessage : undefined,
        isError: true,
        isLoading: false,
        fetchParams: fetchParams,
        timestamp: Date.now()
      }
    });
  };

  private handleGraphDataSourceEmpty = (fetchParams: FetchParams) => {
    this.setState({
      graphData: {
        elements: EMPTY_GRAPH_DATA,
        isLoading: false,
        fetchParams: fetchParams,
        timestamp: Date.now()
      }
    });
  };

  private handleGraphDataSourceStart = (isPreviousDataInvalid: boolean, fetchParams: FetchParams) => {
    this.setState({
      graphData: {
        elements: isPreviousDataInvalid ? EMPTY_GRAPH_DATA : this.state.graphData.elements,
        fetchParams: fetchParams,
        isLoading: true,
        timestamp: isPreviousDataInvalid ? Date.now() : this.state.graphData.timestamp
      }
    });
  };

  private handleDoubleTap = (event: GraphNodeDoubleTapEvent) => {
    if (event.isInaccessible || event.isServiceEntry) {
      return;
    }

    if (event.hasMissingSC) {
      AlertUtils.add(
        `A node with a missing sidecar provides no node-specific telemetry and can not provide a node detail graph.`,
        undefined,
        MessageType.WARNING
      );
      return;
    }
    if (event.isUnused) {
      AlertUtils.add(
        `An unused node has no node-specific traffic and can not provide a node detail graph.`,
        undefined,
        MessageType.WARNING
      );
      return;
    }
    if (event.isOutside && this.props.setActiveNamespaces) {
      this.props.setActiveNamespaces([{ name: event.namespace }]);
      return;
    }

    // If graph is in the drilled-down view, there is the chance that the user
    // double clicked the same node as in the full graph. Determine if this is
    // the case.
    let sameNode = false;
    const node = this.state.graphData.fetchParams.node;
    if (node) {
      sameNode = node && node.nodeType === event.nodeType;
      switch (event.nodeType) {
        case NodeType.AGGREGATE:
          sameNode = sameNode && node.aggregate === event.aggregate;
          sameNode = sameNode && node.aggregateValue === event.aggregateValue;
          break;
        case NodeType.APP:
          sameNode = sameNode && node.app === event.app;
          sameNode = sameNode && node.version === event.version;
          break;
        case NodeType.SERVICE:
          sameNode = sameNode && node.service === event.service;
          break;
        case NodeType.WORKLOAD:
          sameNode = sameNode && node.workload === event.workload;
          break;
        default:
          sameNode = true; // don't navigate to unsupported node type
      }
    }

    const targetNode = { ...event, namespace: { name: event.namespace } };

    // If, while in the drilled-down graph, the user double clicked the same
    // node as in the main graph, it doesn't make sense to re-load the same view.
    // Instead, assume that the user wants more details for the node and do a
    // redirect to the details page.
    if (sameNode) {
      this.handleDoubleTapSameNode(targetNode);
      return;
    }

    // In case user didn't dounble-tapped the same node, or if graph is in
    // full graph mode, redirect to the drilled-down graph of the chosen node.
    const urlParams: GraphUrlParams = {
      activeNamespaces: this.state.graphData.fetchParams.namespaces,
      duration: this.state.graphData.fetchParams.duration,
      edgeLabelMode: this.props.edgeLabelMode,
      graphLayout: this.props.layout,
      graphType: this.state.graphData.fetchParams.graphType,
      node: targetNode,
      refreshInterval: this.props.refreshInterval,
      showOperationNodes: this.props.showOperationNodes,
      showServiceNodes: this.props.showServiceNodes,
      showUnusedNodes: this.props.showUnusedNodes
    };

    // To ensure updated components get the updated URL, update the URL first and then the state
    history.push(makeNodeGraphUrlFromParams(urlParams));
    if (this.props.setNode) {
      this.props.setNode(targetNode);
    }
  };

  // This allows us to navigate to the service details page when zoomed in on nodes
  private handleDoubleTapSameNode = (targetNode: NodeParamsType) => {
    const makeAppDetailsPageUrl = (namespace: string, nodeType: string, name?: string): string => {
      return `/namespaces/${namespace}/${nodeType}/${name}`;
    };
    const nodeType = targetNode.nodeType;
    let urlNodeType = targetNode.nodeType + 's';
    let name = targetNode.app;
    if (nodeType === 'service') {
      name = targetNode.service;
    } else if (nodeType === 'workload') {
      name = targetNode.workload;
    } else {
      urlNodeType = 'applications';
    }
    const detailsPageUrl = makeAppDetailsPageUrl(targetNode.namespace.name, urlNodeType, name);
    history.push(detailsPageUrl);
    return;
  };

  private toggleHelp = () => {
    if (this.props.showLegend) {
      this.props.toggleLegend();
    }
    if (this.props.activeTour) {
      this.props.endTour();
    } else {
      const firstStop = getNextTourStop(GraphTour, -1, 'forward');
      this.props.startTour({ info: GraphTour, stop: firstStop });
    }
  };

  private setCytoscapeGraph(cytoscapeGraph: any) {
    this.cytoscapeGraphRef.current = cytoscapeGraph;
  }

  private loadGraphDataFromBackend = () => {
    const queryTime: TimeInMilliseconds | undefined = !!this.props.replayQueryTime
      ? this.props.replayQueryTime
      : undefined;

    this.graphDataSource.fetchGraphData({
      namespaces: this.props.node ? [this.props.node.namespace] : this.props.activeNamespaces,
      duration: this.props.duration,
      graphType: this.props.graphType,
      injectServiceNodes: this.props.showServiceNodes,
      edgeLabelMode: this.props.edgeLabelMode,
      showOperationNodes: this.props.showOperationNodes,
      showSecurity: this.props.showSecurity,
      showUnusedNodes: this.props.showUnusedNodes,
      node: this.props.node,
      queryTime: queryTime
    });
  };

  private notifyError = (error: Error, _componentStack: string) => {
    AlertUtils.add(`There was an error when rendering the graph: ${error.message}, please try a different layout`);
  };

  private displayTimeRange = () => {
    const rangeEnd: TimeInMilliseconds = this.state.graphData.timestamp;
    const rangeStart: TimeInMilliseconds = rangeEnd - this.props.duration * 1000;

    return toRangeString(rangeStart, rangeEnd, { second: '2-digit' }, { second: '2-digit' });
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state),
  activeTour: state.tourState.activeTour,
  compressOnHide: state.graph.toolbarState.compressOnHide,
  duration: durationSelector(state),
  edgeLabelMode: edgeLabelModeSelector(state),
  graphType: graphTypeSelector(state),
  isPageVisible: state.globalState.isPageVisible,
  lastRefreshAt: lastRefreshAtSelector(state),
  layout: state.graph.layout,
  node: state.graph.node,
  refreshInterval: refreshIntervalSelector(state),
  replayActive: replayActiveSelector(state),
  replayQueryTime: replayQueryTimeSelector(state),
  showCircuitBreakers: state.graph.toolbarState.showCircuitBreakers,
  showLegend: state.graph.toolbarState.showLegend,
  showMissingSidecars: state.graph.toolbarState.showMissingSidecars,
  showNodeLabels: state.graph.toolbarState.showNodeLabels,
  showOperationNodes: state.graph.toolbarState.showOperationNodes,
  showSecurity: state.graph.toolbarState.showSecurity,
  showServiceNodes: state.graph.toolbarState.showServiceNodes,
  showTrafficAnimation: state.graph.toolbarState.showTrafficAnimation,
  showUnusedNodes: state.graph.toolbarState.showUnusedNodes,
  showVirtualServices: state.graph.toolbarState.showVirtualServices,
  summaryData: state.graph.summaryData,
  trace: state.jaegerState?.selectedTrace,
  mtlsEnabled: meshWideMTLSEnabledSelector(state)
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  displayUnusedNodes: bindActionCreators(GraphToolbarActions.toggleUnusedNodes, dispatch),
  endTour: bindActionCreators(TourActions.endTour, dispatch),
  onNamespaceChange: bindActionCreators(GraphActions.onNamespaceChange, dispatch),
  onReady: (cy: Cy.Core) => dispatch(GraphThunkActions.graphReady(cy)),
  setActiveNamespaces: (namespaces: Namespace[]) => dispatch(NamespaceActions.setActiveNamespaces(namespaces)),
  setGraphDefinition: bindActionCreators(GraphActions.setGraphDefinition, dispatch),
  setNode: bindActionCreators(GraphActions.setNode, dispatch),
  setTraceId: (traceId?: string) => dispatch(JaegerThunkActions.fetchTrace(traceId)),
  setUpdateTime: (val: TimeInMilliseconds) => dispatch(GraphActions.setUpdateTime(val)),
  startTour: bindActionCreators(TourActions.startTour, dispatch),
  toggleLegend: bindActionCreators(GraphToolbarActions.toggleLegend, dispatch),
  updateSummary: (event: CytoscapeClickEvent) => dispatch(GraphActions.updateSummary(event))
});

const GraphPageContainer = connect(mapStateToProps, mapDispatchToProps)(GraphPage);
export default GraphPageContainer;
