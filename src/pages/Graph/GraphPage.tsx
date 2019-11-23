import * as React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { RouteComponentProps } from 'react-router-dom';
import FlexView from 'react-flexview';
import { Breadcrumb, BreadcrumbItem, Button, Title, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { style } from 'typestyle';
import { store } from '../../store/ConfigStore';
import { DurationInSeconds, TimeInMilliseconds, TimeInSeconds } from '../../types/Common';
import Namespace from '../../types/Namespace';
import { GraphType, NodeParamsType, NodeType, SummaryData, UNKNOWN, EdgeLabelMode, Layout } from '../../types/Graph';
import { computePrometheusRateParams } from '../../services/Prometheus';
import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromises';
import * as AlertUtils from '../../utils/AlertUtils';
import CytoscapeGraphContainer from '../../components/CytoscapeGraph/CytoscapeGraph';
import CytoscapeToolbarContainer from '../../components/CytoscapeGraph/CytoscapeToolbar';
import ErrorBoundary from '../../components/ErrorBoundary/ErrorBoundary';
import GraphToolbarContainer from './GraphToolbar/GraphToolbar';
import GraphLegend from './GraphLegend';
import EmptyGraphLayoutContainer from '../../components/EmptyGraphLayout';
import SummaryPanel from './SummaryPanel';
import {
  activeNamespacesSelector,
  durationSelector,
  edgeLabelModeSelector,
  graphDataSelector,
  graphTypeSelector,
  meshWideMTLSEnabledSelector
} from '../../store/Selectors';
import { KialiAppState } from '../../store/Store';
import { KialiAppAction } from '../../actions/KialiAppAction';
import GraphDataThunkActions from '../../actions/GraphDataThunkActions';
import { GraphActions } from '../../actions/GraphActions';
import { GraphToolbarActions } from '../../actions/GraphToolbarActions';
import { NodeContextMenuContainer } from '../../components/CytoscapeGraph/ContextMenu/NodeContextMenu';
import { GlobalActions } from '../../actions/GlobalActions';
import { PfColors } from 'components/Pf/PfColors';
import { KialiIcon, defaultIconStyle } from 'config/KialiIcon';
import { TourActions } from 'actions/TourActions';
import TourStopContainer, { TourInfo, getNextTourStop } from 'components/Tour/TourStop';
import { arrayEquals } from 'utils/Common';
import { isKioskMode, getFocusSelector } from 'utils/SearchParamUtils';
import GraphTour, { GraphTourStops } from './GraphHelpTour';
import { getErrorString } from 'services/Api';

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
  endTour: () => void;
  startTour: ({ info: TourInfo, stop: number }) => void;
};

export type GraphPageProps = RouteComponentProps<Partial<GraphURLPathProps>> & ReduxProps;

const NUMBER_OF_DATAPOINTS = 30;

const breadcrumbStyle = style({
  marginTop: '10px'
});

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

export class GraphPage extends React.Component<GraphPageProps> {
  private loadPromise?: CancelablePromise<any>;
  private readonly errorBoundaryRef: any;
  private cytoscapeGraphRef: any;

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
      this.loadGraphDataFromBackend();
    }

    if (prev.layout.name !== curr.layout.name || prev.graphData !== curr.graphData || activeNamespacesChanged) {
      this.errorBoundaryRef.current.cleanError();
    }

    if (curr.showLegend && this.props.activeTour) {
      this.props.endTour();
    }
  }

  componentWillUnmount() {
    if (this.loadPromise) {
      this.loadPromise.cancel();
    }
  }

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
        <FlexView className={conStyle} column={true}>
          <div className={breadcrumbStyle}>
            <Breadcrumb>
              <BreadcrumbItem isActive={true}>
                <Title headingLevel="h4" size="xl">
                  {this.props.node && this.props.node.nodeType !== NodeType.UNKNOWN
                    ? `Graph for ${this.props.node.nodeType}: ${this.getTitle(this.props.node)}`
                    : 'Graph'}
                </Title>
                <Tooltip key={'graph-tour-help-ot'} position={TooltipPosition.right} content="Graph help tour...">
                  <Button variant="link" style={{ paddingLeft: '6px' }} onClick={this.toggleHelp}>
                    <KialiIcon.Help className={defaultIconStyle} />
                  </Button>
                </Tooltip>
              </BreadcrumbItem>
            </Breadcrumb>
            {this.props.graphTimestamp > 0 && (
              <span className={'pull-right'}>
                {new Date(graphStart).toLocaleDateString(undefined, timeDisplayOptions)}
                {' ... '}
                {new Date(graphEnd).toLocaleDateString(undefined, timeDisplayOptions)}
              </span>
            )}
          </div>
          <div>
            <GraphToolbarContainer disabled={this.props.isLoading} onRefresh={this.handleRefresh} />
          </div>
          <FlexView grow={true} className={cytoscapeGraphWrapperDivStyle}>
            <ErrorBoundary
              ref={this.errorBoundaryRef}
              onError={this.notifyError}
              fallBackComponent={<GraphErrorBoundaryFallback />}
            >
              {this.props.showLegend && (
                <GraphLegend
                  className={graphToolbarStyle}
                  isMTLSEnabled={this.props.mtlsEnabled}
                  closeLegend={this.props.toggleLegend}
                />
              )}
              <TourStopContainer info={GraphTourStops.Graph}>
                <CytoscapeGraphContainer
                  refresh={this.handleRefresh}
                  containerClassName={cytoscapeGraphContainerStyle}
                  ref={refInstance => this.setCytoscapeGraph(refInstance)}
                  isMTLSEnabled={this.props.mtlsEnabled}
                  focusSelector={focusSelector}
                  contextMenuNodeComponent={NodeContextMenuContainer}
                  contextMenuGroupComponent={NodeContextMenuContainer}
                />
              </TourStopContainer>
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
          </FlexView>
        </FlexView>
      </>
    );
  }

  private handleRefresh = () => {
    this.loadGraphDataFromBackend();
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

  private getTitle(node: NodeParamsType) {
    if (node.nodeType === NodeType.APP) {
      let title = node.app;
      if (node.version && node.version !== UNKNOWN) {
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
    this.cytoscapeGraphRef.current = cytoscapeGraph;
  }

  private loadGraphDataFromBackend = () => {
    if (this.loadPromise) {
      this.loadPromise.cancel();
    }
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
    this.loadPromise = makeCancelablePromise(promise);
    this.loadPromise.promise
      .then(() => {
        // nothing currently on success
      })
      .catch(error => {
        if (!error.isCanceled) {
          AlertUtils.addError(`Failed to load graph data: ${getErrorString(error)}`);
        }
      });
  };

  private notifyError = (error: Error, _componentStack: string) => {
    AlertUtils.add(`There was an error when rendering the graph: ${error.message}, please try a different layout`);
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state),
  activeTour: state.tourState.activeTour,
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
  showLegend: state.graph.toolbarState.showLegend,
  showSecurity: state.graph.toolbarState.showSecurity,
  showServiceNodes: state.graph.toolbarState.showServiceNodes,
  showUnusedNodes: state.graph.toolbarState.showUnusedNodes,
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
  toggleLegend: bindActionCreators(GraphToolbarActions.toggleLegend, dispatch),
  setLastRefreshAt: bindActionCreators(GlobalActions.setLastRefreshAt, dispatch),
  endTour: bindActionCreators(TourActions.endTour, dispatch),
  startTour: bindActionCreators(TourActions.startTour, dispatch)
});

const GraphPageContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(GraphPage);
export default GraphPageContainer;
