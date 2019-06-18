import * as React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import FlexView from 'react-flexview';
import { Breadcrumb, Button, Icon, OverlayTrigger, Tooltip } from 'patternfly-react';
import { style } from 'typestyle';
import { store } from '../../store/ConfigStore';
import { DurationInSeconds, PollIntervalInMs, TimeInMilliseconds, TimeInSeconds } from '../../types/Common';
import Namespace from '../../types/Namespace';
import { GraphType, NodeParamsType, NodeType, SummaryData } from '../../types/Graph';
import { EdgeLabelMode, Layout } from '../../types/GraphFilter';
import { computePrometheusRateParams } from '../../services/Prometheus';
import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromises';
import * as MessageCenterUtils from '../../utils/MessageCenter';
import CytoscapeGraphContainer from '../../components/CytoscapeGraph/CytoscapeGraph';
import CytoscapeToolbarContainer from '../../components/CytoscapeGraph/CytoscapeToolbar';
import ErrorBoundary from '../../components/ErrorBoundary/ErrorBoundary';
import GraphFilterContainer from '../../components/GraphFilter/GraphFilter';
import GraphLegend from '../../components/GraphFilter/GraphLegend';
import StatefulTour from '../../components/Tour/StatefulTour';
import EmptyGraphLayoutContainer from '../../components/EmptyGraphLayout';
import SummaryPanel from './SummaryPanel';
import graphHelp from './GraphHelpTour';
import { arrayEquals } from '../../utils/Common';
import { getFocusSelector, isKioskMode } from '../../utils/SearchParamUtils';
import {
  activeNamespacesSelector,
  durationSelector,
  edgeLabelModeSelector,
  graphDataSelector,
  graphTypeSelector,
  meshWideMTLSEnabledSelector,
  refreshIntervalSelector
} from '../../store/Selectors';
import { KialiAppState } from '../../store/Store';
import { KialiAppAction } from '../../actions/KialiAppAction';
import GraphDataThunkActions from '../../actions/GraphDataThunkActions';
import { GraphActions } from '../../actions/GraphActions';
import { GraphFilterActions } from '../../actions/GraphFilterActions';
import { NodeContextMenuContainer } from '../../components/CytoscapeGraph/ContextMenu/NodeContextMenu';
import { GlobalActions } from '../../actions/GlobalActions';

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
  duration: DurationInSeconds; // current duration (dropdown) setting
  edgeLabelMode: EdgeLabelMode;
  graphData: any;
  graphDuration: DurationInSeconds; // duration of current graph
  graphTimestamp: TimeInSeconds; // queryTime of current graph
  graphType: GraphType;
  isError: boolean;
  isLoading: boolean;
  isPageVisible: boolean;
  layout: Layout;
  node?: NodeParamsType;
  pollInterval: PollIntervalInMs;
  showLegend: boolean;
  showSecurity: boolean;
  showServiceNodes: boolean;
  showUnusedNodes: boolean;
  summaryData: SummaryData | null;
  mtlsEnabled: boolean;

  fetchGraphData: (
    namespaces: Namespace[],
    duration: DurationInSeconds,
    graphType: GraphType,
    injectServiceNodes: boolean,
    edgeLabelMode: EdgeLabelMode,
    showSecurity: boolean,
    showUnusedNodes: boolean,
    node?: NodeParamsType
  ) => any;
  graphChanged: () => void;
  setNode: (node?: NodeParamsType) => void;
  toggleLegend: () => void;
  setLastRefreshAt: (lastRefreshAt: TimeInMilliseconds) => void;
};

export type GraphPageProps = RouteComponentProps<Partial<GraphURLPathProps>> & ReduxProps;

type GraphPageState = {
  showHelp: boolean;
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
const cytoscapeGraphWrapperDivStyle = style({ position: 'relative' });
const cytoscapeToolbarWrapperDivStyle = style({
  position: 'absolute',
  bottom: '10px',
  left: '-13px',
  zIndex: 2,
  boxShadow: '2px 2px 6px 0 grey'
});

const graphToolbarStyle = style({
  right: '0',
  bottom: '10px',
  zIndex: 9999,
  position: 'absolute',
  overflow: 'hidden'
});

const GraphErrorBoundaryFallback = () => {
  return (
    <div className={cytoscapeGraphContainerStyle}>
      <EmptyGraphLayoutContainer namespaces={[]} isError={true} />
    </div>
  );
};

const timeDisplayOptions = {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
};

export class GraphPage extends React.Component<GraphPageProps, GraphPageState> {
  private pollTimeoutRef?: number;
  private pollPromise?: CancelablePromise<any>;
  private readonly errorBoundaryRef: any;
  private cytoscapeGraphRef: any;

  static getNodeParamsFromProps(props: RouteComponentProps<Partial<GraphURLPathProps>>): NodeParamsType | undefined {
    const app = props.match.params.app;
    const appOk = app && app !== 'unknown' && app !== 'undefined';
    const namespace = props.match.params.namespace;
    const namespaceOk = namespace && namespace !== 'unknown' && namespace !== 'undefined';
    const service = props.match.params.service;
    const serviceOk = service && service !== 'unknown' && service !== 'undefined';
    const workload = props.match.params.workload;
    const workloadOk = workload && workload !== 'unknown' && workload !== 'undefined';
    if (!appOk && !namespaceOk && !serviceOk && !workloadOk) {
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
    const node: NodeParamsType = {
      app: app!,
      namespace: { name: namespace! },
      nodeType: nodeType,
      service: service!,
      version: version,
      workload: workload!
    };
    return node;
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
    this.state = {
      showHelp: false
    };

    // Let URL override current redux state at construction time
    // Note that state updates will not be posted until until after the first render
    const urlNode = GraphPage.getNodeParamsFromProps(props);
    if (GraphPage.isNodeChanged(urlNode, props.node)) {
      props.setNode(urlNode);
    }
  }

  componentDidMount() {
    // This is a special bookmarking case. If the initial URL is for a node graph then
    // defer the graph fetch until the first component update, when the node is set.
    // (note: to avoid direct store access we could parse the URL again, perhaps that
    // is preferable?  We could also move the logic from the constructor, but that
    // would break our pattern of redux/url handling in the components).
    if (!store.getState().graph.node) {
      this.scheduleNextPollingInterval(0);
    }
  }

  componentWillUnmount() {
    this.removePollingIntervalTimer();
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
      this.props.graphChanged();
    }

    if (
      activeNamespacesChanged ||
      prev.duration !== curr.duration ||
      (prev.edgeLabelMode !== curr.edgeLabelMode &&
        curr.edgeLabelMode === EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE) ||
      prev.graphType !== curr.graphType ||
      prev.showServiceNodes !== curr.showServiceNodes ||
      prev.showSecurity !== curr.showSecurity ||
      prev.showUnusedNodes !== curr.showUnusedNodes ||
      GraphPage.isNodeChanged(prev.node, curr.node)
    ) {
      this.scheduleNextPollingInterval(0);
    } else if (prev.pollInterval !== curr.pollInterval) {
      this.scheduleNextPollingIntervalFromProps();
    }

    if (prev.layout.name !== curr.layout.name || prev.graphData !== curr.graphData || activeNamespacesChanged) {
      this.errorBoundaryRef.current.cleanError();
    }

    if (curr.showLegend && this.state.showHelp) {
      this.setState({ showHelp: false });
    }
  }

  handleRefreshClick = () => {
    this.scheduleNextPollingInterval(0);
  };

  toggleHelp = () => {
    if (this.props.showLegend) {
      this.props.toggleLegend();
    }
    this.setState({
      showHelp: !this.state.showHelp
    });
  };

  render() {
    const graphEnd: TimeInMilliseconds = this.props.graphTimestamp * 1000;
    const graphStart: TimeInMilliseconds = graphEnd - this.props.graphDuration * 1000;
    let conStyle = containerStyle;
    if (isKioskMode()) {
      conStyle = kioskContainerStyle;
    }
    const focusSelector = getFocusSelector();
    return (
      <>
        <StatefulTour steps={graphHelp} isOpen={this.state.showHelp} onClose={this.toggleHelp} />
        <FlexView className={conStyle} column={true}>
          <div>
            <Breadcrumb title={true}>
              <Breadcrumb.Item active={true}>
                {this.props.node && this.props.node.nodeType !== NodeType.UNKNOWN
                  ? `Graph for ${this.props.node.nodeType}: ${this.getTitle(this.props.node)}`
                  : 'Graph'}
                <OverlayTrigger
                  key={'graph-tour-help-ot'}
                  placement="right"
                  overlay={<Tooltip id={'graph-tour-help-tt'}>Graph help tour...</Tooltip>}
                >
                  <Button bsStyle="link" style={{ paddingLeft: '6px' }} onClick={this.toggleHelp}>
                    <Icon type="pf" name="help" />
                  </Button>
                </OverlayTrigger>
              </Breadcrumb.Item>
              {this.props.graphTimestamp > 0 && (
                <span className={'pull-right'}>
                  {new Date(graphStart).toLocaleDateString(undefined, timeDisplayOptions)}
                  {' ... '}
                  {new Date(graphEnd).toLocaleDateString(undefined, timeDisplayOptions)}
                </span>
              )}
            </Breadcrumb>
          </div>
          <div>
            {/* Use empty div to reset the flex, this component doesn't seem to like that. It renders all its contents in the center */}
            <GraphFilterContainer disabled={this.props.isLoading} onRefresh={this.handleRefreshClick} />
          </div>
          <FlexView grow={true} className={cytoscapeGraphWrapperDivStyle}>
            <ErrorBoundary
              ref={this.errorBoundaryRef}
              onError={this.notifyError}
              fallBackComponent={<GraphErrorBoundaryFallback />}
            >
              <CytoscapeGraphContainer
                refresh={this.handleRefreshClick}
                containerClassName={cytoscapeGraphContainerStyle}
                ref={refInstance => this.setCytoscapeGraph(refInstance)}
                isMTLSEnabled={this.props.mtlsEnabled}
                focusSelector={focusSelector}
                contextMenuNodeComponent={NodeContextMenuContainer}
                contextMenuGroupComponent={NodeContextMenuContainer}
              />
              {this.props.graphData.nodes && Object.keys(this.props.graphData.nodes).length > 0 && !this.props.isError && (
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
                queryTime={this.props.graphTimestamp}
                duration={this.props.graphDuration}
                isPageVisible={this.props.isPageVisible}
                {...computePrometheusRateParams(this.props.duration, NUMBER_OF_DATAPOINTS)}
              />
            )}
            {this.props.showLegend && (
              <GraphLegend
                className={graphToolbarStyle}
                isMTLSEnabled={this.props.mtlsEnabled}
                closeLegend={this.props.toggleLegend}
              />
            )}
          </FlexView>
        </FlexView>
      </>
    );
  }

  private getTitle(node: NodeParamsType) {
    if (node.nodeType === NodeType.APP) {
      let title = node.app;
      if (node.version) {
        title += ' - ' + node.version;
      }

      return title;
    } else if (node.nodeType === NodeType.SERVICE) {
      return node.service;
    } else if (node.nodeType === NodeType.WORKLOAD) {
      return node.workload;
    }

    return 'unknown';
  }

  private setCytoscapeGraph(cytoscapeGraph: any) {
    this.cytoscapeGraphRef.current = cytoscapeGraph ? cytoscapeGraph.getWrappedInstance() : null;
  }

  private loadGraphDataFromBackend = () => {
    const promise = this.props.fetchGraphData(
      this.props.node ? [this.props.node.namespace] : this.props.activeNamespaces,
      this.props.duration,
      this.props.graphType,
      this.props.showServiceNodes,
      this.props.edgeLabelMode,
      this.props.showSecurity,
      this.props.showUnusedNodes,
      this.props.node
    );
    this.pollPromise = makeCancelablePromise(promise);

    this.pollPromise.promise
      .then(() => {
        this.props.setLastRefreshAt(Date.now());
        this.scheduleNextPollingIntervalFromProps();
      })
      .catch(error => {
        if (!error.isCanceled) {
          this.scheduleNextPollingIntervalFromProps();
        }
      });
  };

  private scheduleNextPollingIntervalFromProps() {
    if (this.props.pollInterval > 0) {
      this.scheduleNextPollingInterval(this.props.pollInterval);
    } else {
      this.removePollingIntervalTimer();
    }
  }

  private scheduleNextPollingInterval(pollInterval: number) {
    // Remove any pending timeout to avoid having multiple requests at once
    this.removePollingIntervalTimer();

    if (pollInterval === 0) {
      this.loadGraphDataFromBackend();
    } else {
      // We are using setTimeout instead of setInterval because we have more control over it
      // e.g. If a request takes much time, the next interval will fire up anyway and is
      // possible that it will take much time as well. Instead wait for it to timeout/error to
      // try again.
      this.pollTimeoutRef = window.setTimeout(this.loadGraphDataFromBackend, pollInterval);
    }
  }

  private removePollingIntervalTimer() {
    if (this.pollTimeoutRef) {
      clearTimeout(this.pollTimeoutRef);
      this.pollTimeoutRef = undefined;
    }

    if (this.pollPromise) {
      this.pollPromise.cancel();
      this.pollPromise = undefined;
    }
  }

  private notifyError = (error: Error, _componentStack: string) => {
    MessageCenterUtils.add(
      `There was an error when rendering the graph: ${error.message}, please try a different layout`
    );
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state),
  duration: durationSelector(state),
  edgeLabelMode: edgeLabelModeSelector(state),
  graphData: graphDataSelector(state),
  graphDuration: state.graph.graphDataDuration,
  graphTimestamp: state.graph.graphDataTimestamp,
  graphType: graphTypeSelector(state),
  isError: state.graph.isError,
  isLoading: state.graph.isLoading,
  isPageVisible: state.globalState.isPageVisible,
  layout: state.graph.layout,
  node: state.graph.node,
  pollInterval: refreshIntervalSelector(state),
  showLegend: state.graph.filterState.showLegend,
  showSecurity: state.graph.filterState.showSecurity,
  showServiceNodes: state.graph.filterState.showServiceNodes,
  showUnusedNodes: state.graph.filterState.showUnusedNodes,
  summaryData: state.graph.summaryData,
  mtlsEnabled: meshWideMTLSEnabledSelector(state)
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  fetchGraphData: (
    namespaces: Namespace[],
    duration: DurationInSeconds,
    graphType: GraphType,
    injectServiceNodes: boolean,
    edgeLabelMode: EdgeLabelMode,
    showSecurity: boolean,
    showUnusedNodes: boolean,
    node?: NodeParamsType
  ) =>
    dispatch(
      GraphDataThunkActions.fetchGraphData(
        namespaces,
        duration,
        graphType,
        injectServiceNodes,
        edgeLabelMode,
        showSecurity,
        showUnusedNodes,
        node
      )
    ),
  graphChanged: bindActionCreators(GraphActions.changed, dispatch),
  setNode: bindActionCreators(GraphActions.setNode, dispatch),
  toggleLegend: bindActionCreators(GraphFilterActions.toggleLegend, dispatch),
  setLastRefreshAt: bindActionCreators(GlobalActions.setLastRefreshAt, dispatch)
});

const GraphPageContainer = withRouter<RouteComponentProps<{}>>(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(GraphPage)
);
export default GraphPageContainer;
