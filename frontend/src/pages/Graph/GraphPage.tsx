import * as React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import FlexView from 'react-flexview';
import { kialiStyle } from 'styles/StyleUtils';
import { DurationInSeconds, IntervalInMilliseconds, TimeInMilliseconds, TimeInSeconds } from '../../types/Common';
import { Namespace } from '../../types/Namespace';
import {
  GraphEvent,
  DecoratedGraphElements,
  EdgeLabelMode,
  GraphDefinition,
  GraphType,
  NodeParamsType,
  NodeType,
  SummaryData,
  UNKNOWN,
  TrafficRate,
  RankMode,
  RankResult,
  EdgeMode
} from '../../types/Graph';
import { computePrometheusRateParams } from '../../services/Prometheus';
import * as AlertUtils from '../../utils/AlertUtils';
import { ErrorBoundary } from '../../components/ErrorBoundary/ErrorBoundary';
import { GraphToolbar } from '../Graph/GraphToolbar/GraphToolbar';
import { EmptyGraphLayout } from '../../pages/Graph/EmptyGraphLayout';
import { SummaryPanel } from '../Graph/SummaryPanel';
import {
  activeNamespacesSelector,
  durationSelector,
  edgeLabelsSelector,
  edgeModeSelector,
  findValueSelector,
  graphTypeSelector,
  hideValueSelector,
  meshWideMTLSEnabledSelector,
  refreshIntervalSelector,
  replayActiveSelector,
  replayQueryTimeSelector,
  trafficRatesSelector
} from '../../store/Selectors';
import { KialiAppState } from '../../store/Store';
import { GraphActions } from '../../actions/GraphActions';
import { GraphToolbarActions } from '../../actions/GraphToolbarActions';
import { PFColors } from 'components/Pf/PfColors';
import { TourActions } from 'actions/TourActions';
import { arrayEquals } from 'utils/Common';
import { isKioskMode, getFocusSelector, getTraceId, getClusterName, unsetFocusSelector } from 'utils/SearchParamUtils';
import { Badge, Chip } from '@patternfly/react-core';
import { toRangeString } from 'components/Time/Utils';
import { replayBorder } from 'components/Time/Replay';
import { GraphDataSource, FetchParams, EMPTY_GRAPH_DATA } from '../../services/GraphDataSource';
import { NamespaceActions } from '../../actions/NamespaceAction';
import { GraphThunkActions } from '../../actions/GraphThunkActions';
import { JaegerTrace } from 'types/TracingInfo';
import { KialiDispatch } from 'types/Redux';
import { TracingThunkActions } from 'actions/TracingThunkActions';
import { GraphTour } from 'pages/Graph/GraphHelpTour';
import { getNextTourStop, TourInfo } from 'components/Tour/TourStop';
import { ServiceWizard } from 'components/IstioWizards/ServiceWizard';
import { ServiceDetailsInfo } from 'types/ServiceInfo';
import { DestinationRuleC, PeerAuthentication } from 'types/IstioObjects';
import { WizardAction, WizardMode } from 'components/IstioWizards/WizardActions';
import { ConfirmDeleteTrafficRoutingModal } from 'components/IstioWizards/ConfirmDeleteTrafficRoutingModal';
import { deleteServiceTrafficRouting } from 'services/Api';
import { canCreate, canUpdate } from '../../types/Permissions';
import { connectRefresh } from '../../components/Refresh/connectRefresh';
import { triggerRefresh } from '../../hooks/refresh';
import { Graph, FocusNode, getValidGraphLayout, GraphLayout } from './Graph';
import { Controller } from '@patternfly/react-topology';
import { GraphLegend } from './GraphLegend';
import { HistoryManager, URLParam } from 'app/History';
import { elementsChanged } from 'helpers/GraphHelpers';

// GraphURLPathProps holds path variable values.  Currently all path variables are relevant only to a node graph
export type GraphURLPathProps = {
  aggregate: string;
  aggregateValue: string;
  app: string;
  namespace: string;
  service: string;
  version: string;
  workload: string;
};

type ReduxDispatchProps = {
  endTour: () => void;
  onNamespaceChange: () => void;
  onReady: (controller: any) => void;
  setActiveNamespaces: (namespaces: Namespace[]) => void;
  setEdgeMode: (edgeMode: EdgeMode) => void;
  setGraphDefinition: (graphDefinition: GraphDefinition) => void;
  setLayout: (layout: GraphLayout) => void;
  setNode: (node?: NodeParamsType) => void;
  setRankResult: (result: RankResult) => void;
  setTraceId: (traceId?: string) => void;
  setUpdateTime: (val: TimeInMilliseconds) => void;
  startTour: ({ info, stop }) => void;
  toggleIdleNodes: () => void;
  toggleLegend: () => void;
  updateSummary: (event: GraphEvent) => void;
};
type ReduxStateProps = {
  activeNamespaces: Namespace[];
  activeTour?: TourInfo;
  boxByCluster: boolean;
  boxByNamespace: boolean;
  duration: DurationInSeconds; // current duration (dropdown) setting
  edgeLabels: EdgeLabelMode[];
  edgeMode: EdgeMode;
  findValue: string;
  graphType: GraphType;
  hideValue: string;
  isPageVisible: boolean;
  istioAPIEnabled: boolean;
  kiosk: string;
  layout: GraphLayout;
  mtlsEnabled: boolean;
  namespaceLayout: GraphLayout;
  node?: NodeParamsType;
  rankBy: RankMode[];
  refreshInterval: IntervalInMilliseconds;
  replayActive: boolean;
  replayQueryTime: TimeInMilliseconds;
  showIdleEdges: boolean;
  showIdleNodes: boolean;
  showLegend: boolean;
  showOperationNodes: boolean;
  showOutOfMesh: boolean;
  showRank: boolean;
  showSecurity: boolean;
  showServiceNodes: boolean;
  showTrafficAnimation: boolean;
  showVirtualServices: boolean;
  showWaypoints: boolean;
  summaryData: SummaryData | null;
  trace?: JaegerTrace;
  trafficRates: TrafficRate[];
};
type ReduxProps = ReduxStateProps & ReduxDispatchProps;

export type GraphPageProps = Partial<GraphURLPathProps> &
  ReduxProps & {
    lastRefreshAt: TimeInMilliseconds; // redux by way of ConnectRefresh
  };

export type GraphData = {
  elements: DecoratedGraphElements;
  elementsChanged: boolean; // true if current elements differ from previous fetch, can be used as an optimization.
  errorMessage?: string;
  fetchParams: FetchParams;
  isError?: boolean;
  isLoading: boolean;
  timestamp: TimeInMilliseconds;
};

// GraphRefs are passed back from the graph when it is ready, to allow for
// other components, or test code, to manipulate the graph programatically.
export type GraphRefs = {
  getController: () => Controller;
  setSelectedIds: (values: string[]) => void;
};

type WizardsData = {
  // Data (payload) sent to the wizard or the confirm delete dialog
  gateways: string[];
  k8sGateways: string[];
  namespace: string;
  peerAuthentications: PeerAuthentication[];
  serviceDetails?: ServiceDetailsInfo;
  // Wizard configuration
  showWizard: boolean;
  updateMode: boolean;
  wizardType: string;
};

type GraphPageState = {
  graphData: GraphData;
  graphRefs?: GraphRefs;
  isReady: boolean;
  showConfirmDeleteTrafficRouting: boolean;
  wizardsData: WizardsData;
};

const NUMBER_OF_DATAPOINTS = 30;

const containerStyle = kialiStyle({
  minHeight: '350px',
  // TODO: try flexbox to remove this calc
  height: 'calc(100vh - 113px)' // View height minus top bar height minus secondary masthead
});

const kioskContainerStyle = kialiStyle({
  minHeight: '350px',
  height: 'calc(100vh - 10px)' // View height minus top bar height
});

const graphContainerStyle = kialiStyle({ flex: '1', minWidth: '350px', zIndex: 0, paddingRight: '5px' });
const graphWrapperDivStyle = kialiStyle({ position: 'relative', backgroundColor: PFColors.BackgroundColor200 });

const graphTimeRange = kialiStyle({
  position: 'absolute',
  top: '10px',
  left: '10px',
  width: 'auto',
  zIndex: 2
});

const replayBackground = kialiStyle({
  backgroundColor: PFColors.Replay
});

const graphBackground = kialiStyle({
  backgroundColor: PFColors.BackgroundColor100
});

const GraphErrorBoundaryFallback = (): React.ReactElement => {
  return (
    <div className={graphContainerStyle}>
      <EmptyGraphLayout
        isError={true}
        isMiniGraph={false}
        namespaces={[]}
        showIdleNodes={false}
        toggleIdleNodes={() => undefined}
      />
    </div>
  );
};

class GraphPageComponent extends React.Component<GraphPageProps, GraphPageState> {
  private readonly errorBoundaryRef: any;
  private focusNode?: FocusNode;
  private graphDataSource: GraphDataSource;

  static getNodeParamsFromProps(props: Partial<GraphURLPathProps>): NodeParamsType | undefined {
    const aggregate = props.aggregate;
    const aggregateOk = aggregate && aggregate !== UNKNOWN;
    const aggregateValue = props.aggregateValue;
    const aggregateValueOk = aggregateValue && aggregateValue !== UNKNOWN;
    const app = props.app;
    const appOk = app && app !== UNKNOWN;
    const namespace = props.namespace;
    const namespaceOk = namespace && namespace !== UNKNOWN;
    const service = props.service;
    const serviceOk = service && service !== UNKNOWN;
    const workload = props.workload;
    const workloadOk = workload && workload !== UNKNOWN;
    if (!aggregateOk && !aggregateValueOk && !appOk && !namespaceOk && !serviceOk && !workloadOk) {
      // @ts-ignore
      return;
    }

    let nodeType: NodeType;
    let version: string | undefined;
    if (aggregateOk) {
      nodeType = NodeType.AGGREGATE;
      version = '';
    } else if (appOk || workloadOk) {
      nodeType = appOk ? NodeType.APP : NodeType.WORKLOAD;
      version = props.version;
    } else {
      nodeType = NodeType.SERVICE;
      version = '';
    }
    return {
      aggregate: aggregate!,
      aggregateValue: aggregateValue!,
      app: app!,
      cluster: getClusterName(),
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
      const nodeAggregateHasChanged =
        prevNode.aggregate !== node.aggregate || prevNode.aggregateValue !== node.aggregateValue;
      const nodeAppHasChanged = prevNode.app !== node.app;
      const nodeServiceHasChanged = prevNode.service !== node.service;
      const nodeVersionHasChanged = prevNode.version !== node.version;
      const nodeTypeHasChanged = prevNode.nodeType !== node.nodeType;
      const nodeWorkloadHasChanged = prevNode.workload !== node.workload;
      return (
        nodeAggregateHasChanged ||
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
    const focusNodeId = getFocusSelector();
    if (focusNodeId) {
      this.focusNode = { id: focusNodeId, isSelected: true } as FocusNode;
      unsetFocusSelector();
    }
    this.graphDataSource = new GraphDataSource();

    this.state = {
      graphData: {
        elements: { edges: [], nodes: [] },
        elementsChanged: false,
        fetchParams: this.graphDataSource.fetchParameters,
        isLoading: true,
        timestamp: 0
      },
      isReady: false,
      wizardsData: {
        showWizard: false,
        wizardType: '',
        updateMode: false,
        gateways: [],
        k8sGateways: [],
        peerAuthentications: [],
        namespace: ''
      },
      showConfirmDeleteTrafficRouting: false
    };
  }

  componentDidMount(): void {
    // Connect to graph data source updates
    this.graphDataSource.on('loadStart', this.handleGraphDataSourceStart);
    this.graphDataSource.on('fetchError', this.handleGraphDataSourceError);
    this.graphDataSource.on('fetchSuccess', this.handleGraphDataSourceSuccess);
    this.graphDataSource.on('emptyNamespaces', this.handleGraphDataSourceEmpty);

    // Let URL override current redux state at mount time.  We usually do this in
    // the constructor but it seems to work better here when the initial URL
    // is for a node graph.  When setting the node here it is available for the
    // loadGraphFromBackend() call.
    const urlNode = GraphPageComponent.getNodeParamsFromProps(this.props);
    if (GraphPageComponent.isNodeChanged(urlNode, this.props.node)) {
      // add the node namespace if necessary, but don't lose previously selected namespaces
      if (urlNode && !this.props.activeNamespaces.map(ns => ns.name).includes(urlNode.namespace.name)) {
        this.props.setActiveNamespaces([urlNode.namespace, ...this.props.activeNamespaces]);
      }
      this.props.setNode(urlNode);
    }

    // trace url info
    const urlTrace = getTraceId();
    if (urlTrace !== this.props.trace?.traceID) {
      this.props.setTraceId(urlTrace);
    }

    // layout url info
    const urlLayout = HistoryManager.getParam(URLParam.GRAPH_LAYOUT);
    if (urlLayout) {
      const validLayout = getValidGraphLayout(urlLayout);
      if (validLayout !== this.props.layout) {
        this.props.setLayout(validLayout);
        HistoryManager.setParam(URLParam.GRAPH_LAYOUT, validLayout);
      }
    } else {
      HistoryManager.setParam(URLParam.GRAPH_LAYOUT, this.props.layout);
    }

    // Ensure we initialize the graph. We wait for the toolbar to render and
    // ensure all redux props are updated with URL settings.
    // That in turn ensures the initial fetchParams are correct.
    setTimeout(() => this.loadGraphDataFromBackend(), 0);
  }

  componentDidUpdate(prev: GraphPageProps): void {
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
      prev.boxByCluster !== curr.boxByCluster ||
      prev.boxByNamespace !== curr.boxByNamespace ||
      prev.duration !== curr.duration ||
      (prev.edgeLabels !== curr.edgeLabels && // test for edge labels that invoke graph gen appenders
        (curr.edgeLabels.includes(EdgeLabelMode.RESPONSE_TIME_GROUP) ||
          curr.edgeLabels.includes(EdgeLabelMode.THROUGHPUT_GROUP))) ||
      (prev.findValue !== curr.findValue && curr.findValue.includes('label:')) ||
      prev.graphType !== curr.graphType ||
      (prev.hideValue !== curr.hideValue && curr.hideValue.includes('label:')) ||
      (prev.lastRefreshAt !== curr.lastRefreshAt && curr.replayQueryTime === 0) ||
      (prev.replayActive !== curr.replayActive && !curr.replayActive) ||
      prev.replayQueryTime !== curr.replayQueryTime ||
      prev.showIdleEdges !== curr.showIdleEdges ||
      prev.showOperationNodes !== curr.showOperationNodes ||
      prev.showServiceNodes !== curr.showServiceNodes ||
      prev.showSecurity !== curr.showSecurity ||
      prev.showIdleNodes !== curr.showIdleNodes ||
      prev.showWaypoints !== curr.showWaypoints ||
      prev.trafficRates !== curr.trafficRates ||
      GraphPageComponent.isNodeChanged(prev.node, curr.node)
    ) {
      this.loadGraphDataFromBackend();
    }

    if (prev.layout !== curr.layout || prev.namespaceLayout !== curr.namespaceLayout || activeNamespacesChanged) {
      this.errorBoundaryRef.current.cleanError();
    }

    if (curr.showLegend && this.props.activeTour) {
      this.props.endTour();
    }
  }

  componentWillUnmount(): void {
    // Disconnect from graph data source updates
    this.graphDataSource.removeListener('loadStart', this.handleGraphDataSourceStart);
    this.graphDataSource.removeListener('fetchError', this.handleGraphDataSourceError);
    this.graphDataSource.removeListener('fetchSuccess', this.handleGraphDataSourceSuccess);
    this.graphDataSource.removeListener('emptyNamespaces', this.handleGraphDataSourceEmpty);
  }

  render(): React.ReactNode {
    let conStyle = containerStyle;
    if (isKioskMode()) {
      conStyle = kioskContainerStyle;
    }
    const isEmpty = !(
      this.state.graphData.elements.nodes && Object.keys(this.state.graphData.elements.nodes).length > 0
    );
    const isReady = !(isEmpty || this.state.graphData.isError);
    const isReplayReady = this.props.replayActive && !!this.props.replayQueryTime;

    return (
      <>
        <FlexView className={conStyle} column={true}>
          <div>
            <GraphToolbar
              controller={this.state.graphRefs?.getController()}
              disabled={this.state.graphData.isLoading}
              elementsChanged={this.state.graphData.elementsChanged}
              onToggleHelp={this.toggleHelp}
            />
          </div>
          <FlexView grow={true} className={`${graphWrapperDivStyle} ${this.props.replayActive && replayBorder}`}>
            <ErrorBoundary
              ref={this.errorBoundaryRef}
              onError={this.notifyError}
              fallBackComponent={<GraphErrorBoundaryFallback />}
            >
              {this.props.showLegend && <GraphLegend closeLegend={this.props.toggleLegend} />}
              {isReady && (
                <Chip
                  className={`${graphTimeRange} ${this.props.replayActive ? replayBackground : graphBackground}`}
                  isReadOnly={true}
                >
                  {this.props.replayActive && <Badge style={{ marginRight: '4px' }} isRead={true}>{`Replay`}</Badge>}
                  {!isReplayReady && this.props.replayActive && `click Play to start`}
                  {!isReplayReady && !this.props.replayActive && `${this.displayTimeRange()}`}
                  {isReplayReady && `${this.displayTimeRange()}`}
                </Chip>
              )}
              {(!this.props.replayActive || isReplayReady) && (
                <div id="pft-graph" className={graphContainerStyle}>
                  <EmptyGraphLayout
                    action={this.handleEmptyGraphAction}
                    elements={this.state.graphData.elements}
                    error={this.state.graphData.errorMessage}
                    isLoading={this.state.graphData.isLoading}
                    isError={!!this.state.graphData.isError}
                    isMiniGraph={false}
                    namespaces={this.state.graphData.fetchParams.namespaces}
                    showIdleNodes={this.props.showIdleNodes}
                    toggleIdleNodes={this.props.toggleIdleNodes}
                  >
                    <Graph
                      {...this.props}
                      focusNode={this.focusNode}
                      graphData={this.state.graphData}
                      isMiniGraph={false}
                      onDeleteTrafficRouting={this.handleDeleteTrafficRouting}
                      onLaunchWizard={this.handleLaunchWizard}
                      onReady={this.handleReady}
                    />
                  </EmptyGraphLayout>
                </div>
              )}
            </ErrorBoundary>
            {this.props.summaryData && (
              <SummaryPanel
                data={this.props.summaryData}
                duration={this.state.graphData.fetchParams.duration}
                graphType={this.props.graphType}
                injectServiceNodes={this.props.showServiceNodes}
                isPageVisible={this.props.isPageVisible}
                namespaces={this.props.activeNamespaces}
                onDeleteTrafficRouting={this.handleDeleteTrafficRouting}
                onFocus={this.onFocus}
                onLaunchWizard={this.handleLaunchWizard}
                queryTime={this.state.graphData.timestamp / 1000}
                trafficRates={this.props.trafficRates}
                {...computePrometheusRateParams(this.props.duration, NUMBER_OF_DATAPOINTS)}
              />
            )}
          </FlexView>
        </FlexView>
        <ServiceWizard
          show={this.state.wizardsData.showWizard}
          type={this.state.wizardsData.wizardType}
          update={this.state.wizardsData.updateMode}
          namespace={this.state.wizardsData.namespace}
          cluster={this.state.wizardsData.serviceDetails?.service.cluster || ''}
          serviceName={this.state.wizardsData.serviceDetails?.service?.name || ''}
          workloads={this.state.wizardsData.serviceDetails?.workloads || []}
          subServices={this.state.wizardsData.serviceDetails?.subServices || []}
          createOrUpdate={
            canCreate(this.state.wizardsData.serviceDetails?.istioPermissions) ||
            canUpdate(this.state.wizardsData.serviceDetails?.istioPermissions)
          }
          virtualServices={this.state.wizardsData.serviceDetails?.virtualServices || []}
          destinationRules={this.state.wizardsData.serviceDetails?.destinationRules || []}
          gateways={this.state.wizardsData.gateways || []}
          k8sGateways={this.state.wizardsData.k8sGateways || []}
          k8sGRPCRoutes={this.state.wizardsData.serviceDetails?.k8sGRPCRoutes || []}
          k8sHTTPRoutes={this.state.wizardsData.serviceDetails?.k8sHTTPRoutes || []}
          peerAuthentications={this.state.wizardsData.peerAuthentications || []}
          tlsStatus={this.state.wizardsData.serviceDetails?.namespaceMTLS}
          onClose={this.handleWizardClose}
          istioAPIEnabled={this.props.istioAPIEnabled}
        />
        {this.state.showConfirmDeleteTrafficRouting && (
          <ConfirmDeleteTrafficRoutingModal
            isOpen={true}
            destinationRules={DestinationRuleC.fromDrArray(this.state.wizardsData.serviceDetails!.destinationRules)}
            virtualServices={this.state.wizardsData.serviceDetails!.virtualServices}
            k8sHTTPRoutes={this.state.wizardsData.serviceDetails!.k8sHTTPRoutes}
            k8sGRPCRoutes={this.state.wizardsData.serviceDetails!.k8sGRPCRoutes}
            onCancel={() => this.setState({ showConfirmDeleteTrafficRouting: false })}
            onConfirm={this.handleConfirmDeleteServiceTrafficRouting}
          />
        )}
      </>
    );
  }

  // TODO Focus...
  private onFocus = (focusNode: FocusNode): void => {
    console.debug(`onFocus(${focusNode})`);
  };

  private handleReady = (refs: GraphRefs): void => {
    this.setState({ graphRefs: refs, isReady: true });
  };

  private handleEmptyGraphAction = (): void => {
    this.loadGraphDataFromBackend();
  };

  private handleGraphDataSourceSuccess = (
    graphTimestamp: TimeInSeconds,
    _,
    elements: DecoratedGraphElements,
    fetchParams: FetchParams
  ): void => {
    const prevElements = this.state.graphData.elements;
    this.setState({
      graphData: {
        elements: elements,
        elementsChanged: elementsChanged(prevElements, elements),
        isLoading: false,
        fetchParams: fetchParams,
        timestamp: graphTimestamp * 1000
      } as GraphData
    });
    this.props.setGraphDefinition(this.graphDataSource.graphDefinition);
  };

  private handleGraphDataSourceError = (errorMessage: string | null, fetchParams: FetchParams): void => {
    const prevElements = this.state.graphData.elements;
    this.setState({
      graphData: {
        elements: EMPTY_GRAPH_DATA,
        elementsChanged: elementsChanged(prevElements, EMPTY_GRAPH_DATA),
        errorMessage: !!errorMessage ? errorMessage : undefined,
        isError: true,
        isLoading: false,
        fetchParams: fetchParams,
        timestamp: Date.now()
      }
    });
  };

  private handleGraphDataSourceEmpty = (fetchParams: FetchParams): void => {
    const prevElements = this.state.graphData.elements;
    this.setState({
      graphData: {
        elements: EMPTY_GRAPH_DATA,
        elementsChanged: elementsChanged(prevElements, EMPTY_GRAPH_DATA),
        isLoading: false,
        fetchParams: fetchParams,
        timestamp: Date.now()
      }
    });
  };

  private handleGraphDataSourceStart = (isPreviousDataInvalid: boolean, fetchParams: FetchParams): void => {
    this.setState({
      graphData: {
        elements: isPreviousDataInvalid ? EMPTY_GRAPH_DATA : this.state.graphData.elements,
        elementsChanged: false,
        fetchParams: fetchParams,
        isLoading: true,
        timestamp: isPreviousDataInvalid ? Date.now() : this.state.graphData.timestamp
      }
    });
  };

  private handleLaunchWizard = (
    action: WizardAction,
    mode: WizardMode,
    namespace: string,
    serviceDetails: ServiceDetailsInfo,
    gateways: string[],
    peerAuths: PeerAuthentication[]
  ): void => {
    this.setState(prevState => ({
      wizardsData: {
        ...prevState.wizardsData,
        showWizard: true,
        wizardType: action,
        updateMode: mode === 'update',
        namespace: namespace,
        serviceDetails: serviceDetails,
        gateways: gateways,
        peerAuthentications: peerAuths
      }
    }));
  };

  private handleWizardClose = (changed: boolean): void => {
    if (changed) {
      this.setState(prevState => ({
        wizardsData: {
          ...prevState.wizardsData,
          showWizard: false
        }
      }));
      triggerRefresh();
    } else {
      this.setState(prevState => ({
        wizardsData: {
          ...prevState.wizardsData,
          showWizard: false
        }
      }));
    }
  };

  private handleDeleteTrafficRouting = (_key: string, serviceDetail: ServiceDetailsInfo): void => {
    this.setState(prevState => ({
      showConfirmDeleteTrafficRouting: true,
      wizardsData: {
        ...prevState.wizardsData,
        serviceDetails: serviceDetail
      }
    }));
  };

  private handleConfirmDeleteServiceTrafficRouting = (): void => {
    this.setState({
      showConfirmDeleteTrafficRouting: false
    });

    deleteServiceTrafficRouting(this.state.wizardsData!.serviceDetails!)
      .then(_results => {
        AlertUtils.addSuccess(
          `Istio Config deleted for ${this.state.wizardsData.serviceDetails?.service.name} service.`
        );

        triggerRefresh();
      })
      .catch(error => {
        AlertUtils.addError('Could not delete Istio config objects.', error);
      });
  };

  private toggleHelp = (): void => {
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

  private loadGraphDataFromBackend = (): void => {
    const queryTime: TimeInMilliseconds | undefined = !!this.props.replayQueryTime
      ? this.props.replayQueryTime
      : undefined;

    this.graphDataSource.fetchGraphData({
      boxByCluster: this.props.boxByCluster,
      boxByNamespace: this.props.boxByNamespace,
      duration: this.props.duration,
      edgeLabels: this.props.edgeLabels,
      graphType: this.props.graphType,
      includeHealth: true,
      includeLabels: this.props.findValue.includes('label:') || this.props.hideValue.includes('label:'),
      injectServiceNodes: this.props.showServiceNodes,
      namespaces: this.props.node ? [this.props.node.namespace] : this.props.activeNamespaces,
      node: this.props.node,
      queryTime: queryTime,
      showIdleEdges: this.props.showIdleEdges,
      showIdleNodes: this.props.showIdleNodes,
      showOperationNodes: this.props.showOperationNodes,
      showSecurity: this.props.showSecurity,
      showWaypoints: this.props.showWaypoints,
      trafficRates: this.props.trafficRates
    });
  };

  private notifyError = (error: Error, _componentStack: string): void => {
    AlertUtils.add(`There was an error when rendering the graph: ${error.message}, please try a different layout`);
  };

  private displayTimeRange = (): string => {
    const rangeEnd: TimeInMilliseconds = this.state.graphData.timestamp;
    const rangeStart: TimeInMilliseconds = rangeEnd - this.props.duration * 1000;

    return toRangeString(rangeStart, rangeEnd, { second: '2-digit' }, { second: '2-digit' });
  };
}

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  activeNamespaces: activeNamespacesSelector(state),
  activeTour: state.tourState.activeTour,
  boxByCluster: state.graph.toolbarState.boxByCluster,
  boxByNamespace: state.graph.toolbarState.boxByNamespace,
  duration: durationSelector(state),
  edgeLabels: edgeLabelsSelector(state),
  edgeMode: edgeModeSelector(state),
  findValue: findValueSelector(state),
  graphType: graphTypeSelector(state),
  hideValue: hideValueSelector(state),
  istioAPIEnabled: state.statusState.istioEnvironment.istioAPIEnabled,
  isPageVisible: state.globalState.isPageVisible,
  kiosk: state.globalState.kiosk,
  layout: state.graph.layout,
  mtlsEnabled: meshWideMTLSEnabledSelector(state),
  namespaceLayout: state.graph.namespaceLayout,
  node: state.graph.node,
  rankBy: state.graph.toolbarState.rankBy,
  refreshInterval: refreshIntervalSelector(state),
  replayActive: replayActiveSelector(state),
  replayQueryTime: replayQueryTimeSelector(state),
  showIdleEdges: state.graph.toolbarState.showIdleEdges,
  showIdleNodes: state.graph.toolbarState.showIdleNodes,
  showLegend: state.graph.toolbarState.showLegend,
  showOutOfMesh: state.graph.toolbarState.showOutOfMesh,
  showOperationNodes: state.graph.toolbarState.showOperationNodes,
  showRank: state.graph.toolbarState.showRank,
  showSecurity: state.graph.toolbarState.showSecurity,
  showServiceNodes: state.graph.toolbarState.showServiceNodes,
  showTrafficAnimation: state.graph.toolbarState.showTrafficAnimation,
  showVirtualServices: state.graph.toolbarState.showVirtualServices,
  showWaypoints: state.graph.toolbarState.showWaypoints,
  summaryData: state.graph.summaryData,
  trace: state.tracingState?.selectedTrace,
  trafficRates: trafficRatesSelector(state)
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => ({
  endTour: bindActionCreators(TourActions.endTour, dispatch),
  onNamespaceChange: bindActionCreators(GraphActions.onNamespaceChange, dispatch),
  onReady: (controller: Controller) => dispatch(GraphThunkActions.graphReady(controller)),
  setActiveNamespaces: (namespaces: Namespace[]) => dispatch(NamespaceActions.setActiveNamespaces(namespaces)),
  setEdgeMode: bindActionCreators(GraphActions.setEdgeMode, dispatch),
  setGraphDefinition: bindActionCreators(GraphActions.setGraphDefinition, dispatch),
  setLayout: bindActionCreators(GraphActions.setLayout, dispatch),
  setNode: bindActionCreators(GraphActions.setNode, dispatch),
  setRankResult: bindActionCreators(GraphActions.setRankResult, dispatch),
  setTraceId: (traceId?: string) => dispatch(TracingThunkActions.setTraceId(traceId)),
  setUpdateTime: (val: TimeInMilliseconds) => dispatch(GraphActions.setUpdateTime(val)),
  startTour: bindActionCreators(TourActions.startTour, dispatch),
  toggleIdleNodes: bindActionCreators(GraphToolbarActions.toggleIdleNodes, dispatch),
  toggleLegend: bindActionCreators(GraphToolbarActions.toggleLegend, dispatch),
  updateSummary: (event: GraphEvent) => dispatch(GraphActions.updateSummary(event))
});

export const GraphPage = connectRefresh(connect(mapStateToProps, mapDispatchToProps)(GraphPageComponent));
