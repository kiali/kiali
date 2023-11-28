import * as React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import FlexView from 'react-flexview';
import { kialiStyle } from 'styles/StyleUtils';
import { IntervalInMilliseconds, TimeInMilliseconds, TimeInSeconds } from '../../types/Common';
import { Layout } from '../../types/Graph';
import { computePrometheusRateParams } from '../../services/Prometheus';
import * as AlertUtils from '../../utils/AlertUtils';
import { ErrorBoundary } from '../../components/ErrorBoundary/ErrorBoundary';
import { GraphToolbar } from '../Graph/GraphToolbar/GraphToolbar';
import { EmptyGraphLayout } from '../../components/CytoscapeGraph/EmptyGraphLayout';
import { SummaryPanel } from '../Graph/SummaryPanel';
import { findValueSelector, hideValueSelector, refreshIntervalSelector } from '../../store/Selectors';
import { KialiAppState } from '../../store/Store';
import { GraphToolbarActions } from '../../actions/GraphToolbarActions';
import { PFColors } from 'components/Pf/PfColors';
import { TourActions } from 'actions/TourActions';
import { arrayEquals } from 'utils/Common';
import { isKioskMode, getFocusSelector, getTraceId, getClusterName } from 'utils/SearchParamUtils';
import { Badge, Chip } from '@patternfly/react-core';
import { toRangeString } from 'components/Time/Utils';
import { replayBorder } from 'components/Time/Replay';
import { MeshDataSource, MeshFetchParams } from '../../services/MeshDataSource';
import { GraphThunkActions } from '../../actions/GraphThunkActions';
import { KialiDispatch } from 'types/Redux';
import { GraphTourPF } from 'pages/Graph/GraphHelpTour';
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
import * as CytoscapeGraphUtils from '../../components/CytoscapeGraph/CytoscapeGraphUtils';
import { Controller } from '@patternfly/react-topology';
import { EmptyMeshLayout } from './EmptyMeshLayout';
import {
  DecoratedMeshEdgeWrapper,
  DecoratedMeshElements,
  DecoratedMeshNodeWrapper,
  MeshDefinition,
  MeshTarget
} from 'types/Mesh';
import { FocusNode } from './Mesh';
import { MeshActions } from 'actions/MeshActions';

type ReduxProps = {
  activeTour?: TourInfo;
  endTour: () => void;
  findValue: string;
  hideValue: string;
  istioAPIEnabled: boolean;
  isPageVisible: boolean;
  kiosk: string;
  layout: Layout;
  mtlsEnabled: boolean;
  onReady: (controller: any) => void;
  refreshInterval: IntervalInMilliseconds;
  setMeshDefinition: (meshDefinition: MeshDefinition) => void;
  setLayout: (layout: Layout) => void;
  setUpdateTime: (val: TimeInMilliseconds) => void;
  showLegend: boolean;
  showOutOfMesh: boolean;
  startTour: ({ info, stop }) => void;
  target: MeshTarget | null;
  toggleLegend: () => void;
  updateSummary: (event: MeshTarget) => void;
};

export type MeshPageProps = ReduxProps & {
  lastRefreshAt: TimeInMilliseconds; // redux by way of ConnectRefresh
};

export type MeshData = {
  elements: DecoratedMeshElements;
  elementsChanged: boolean; // true if current elements differ from previous fetch, can be used as an optimization.
  errorMessage?: string;
  fetchParams: MeshFetchParams;
  isLoading: boolean;
  isError?: boolean;
  timestamp: TimeInMilliseconds;
};

type MeshPageState = {
  meshData: MeshData;
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

const meshContainerStyle = kialiStyle({ flex: '1', minWidth: '350px', zIndex: 0, paddingRight: '5px' });
const meshWrapperDivStyle = kialiStyle({ position: 'relative', backgroundColor: PFColors.BackgroundColor200 });

const meshBackground = kialiStyle({
  backgroundColor: PFColors.BackgroundColor100
});

const meshLegendStyle = kialiStyle({
  right: '0',
  bottom: '10px',
  position: 'absolute',
  overflow: 'hidden'
});

const MeshErrorBoundaryFallback = () => {
  return (
    <div className={meshContainerStyle}>
      <EmptyMeshLayout isError={true} isMiniMesh={false} />
    </div>
  );
};

class MeshPageComponent extends React.Component<MeshPageProps, MeshPageState> {
  private controller?: Controller;
  private readonly errorBoundaryRef: any;
  private focusNode?: FocusNode;
  private meshDataSource: MeshDataSource;

  constructor(props: MeshPageProps) {
    super(props);
    this.controller = undefined;
    this.errorBoundaryRef = React.createRef();
    const focusNodeId = getFocusSelector();
    this.focusNode = focusNodeId ? { id: focusNodeId, isSelected: true } : undefined;
    this.meshDataSource = new MeshDataSource();

    this.state = {
      meshData: {
        elements: { edges: [], nodes: [] },
        elementsChanged: false,
        fetchParams: this.meshDataSource.fetchParameters,
        isLoading: true,
        timestamp: 0
      }
    };
  }

  componentDidMount() {
    // Connect to graph data source updates
    this.meshDataSource.on('loadStart', this.handleMeshDataSourceStart);
    this.meshDataSource.on('fetchError', this.handleMeshDataSourceError);
    this.meshDataSource.on('fetchSuccess', this.handleMeshDataSourceSuccess);
  }

  componentDidUpdate(prev: MeshPageProps) {
    const curr = this.props;

    // Ensure we initialize the graph. We wait for the first update so that
    // the toolbar can render and ensure all redux props are updated with URL
    // settings. That in turn ensures the initial fetchParams are correct.
    const isInitialLoad = !this.state.meshData.timestamp;

    if (curr.target?.type === 'mesh') {
      this.controller = curr.target.elem as Controller;
    }

    if (
      isInitialLoad ||
      (prev.findValue !== curr.findValue && curr.findValue.includes('label:')) ||
      (prev.hideValue !== curr.hideValue && curr.hideValue.includes('label:')) ||
      prev.lastRefreshAt !== curr.lastRefreshAt
    ) {
      this.loadMeshFromBackend();
    }

    if (
      prev.layout.name !== curr.layout.name ||
      prev.namespaceLayout.name !== curr.namespaceLayout.name ||
      activeNamespacesChanged
    ) {
      this.errorBoundaryRef.current.cleanError();
    }

    if (curr.showLegend && this.props.activeTour) {
      this.props.endTour();
    }
  }

  componentWillUnmount() {
    // Disconnect from graph data source updates
    this.meshDataSource.removeListener('loadStart', this.handleMeshDataSourceStart);
    this.meshDataSource.removeListener('fetchError', this.handleMeshDataSourceError);
    this.meshDataSource.removeListener('fetchSuccess', this.handleMeshDataSourceSuccess);
  }

  render() {
    let conStyle = containerStyle;
    if (isKioskMode()) {
      conStyle = kioskContainerStyle;
    }
    const isEmpty = !(this.state.meshData.elements.nodes && Object.keys(this.state.meshData.elements.nodes).length > 0);
    const isReady = !(isEmpty || this.state.meshData.isError);
    const isReplayReady = this.props.replayActive && !!this.props.replayQueryTime;

    return (
      <>
        <FlexView className={conStyle} column={true}>
          <div>
            <GraphToolbar
              controller={this.controller}
              disabled={this.state.meshData.isLoading}
              elementsChanged={this.state.meshData.elementsChanged}
              isPF={true}
              onToggleHelp={this.toggleHelp}
            />
          </div>
          <FlexView grow={true} className={`${meshWrapperDivStyle} ${this.props.replayActive && replayBorder}`}>
            <ErrorBoundary
              ref={this.errorBoundaryRef}
              onError={this.notifyError}
              fallBackComponent={<MeshErrorBoundaryFallback />}
            >
              {this.props.showLegend && (
                <GraphLegendPF className={meshLegendStyle} closeLegend={this.props.toggleLegend} />
              )}
              {isReady && (
                <Chip
                  className={`${graphTimeRange} ${this.props.replayActive ? replayBackground : meshBackground}`}
                  isReadOnly={true}
                >
                  {this.props.replayActive && <Badge style={{ marginRight: '4px' }} isRead={true}>{`Replay`}</Badge>}
                  {!isReplayReady && this.props.replayActive && `click Play to start`}
                  {!isReplayReady && !this.props.replayActive && `${this.displayTimeRange()}`}
                  {isReplayReady && `${this.displayTimeRange()}`}
                </Chip>
              )}
              {(!this.props.replayActive || isReplayReady) && (
                <div id="cytoscape-graph" className={meshContainerStyle}>
                  <EmptyGraphLayout
                    action={this.handleEmptyGraphAction}
                    elements={this.state.meshData.elements}
                    error={this.state.meshData.errorMessage}
                    isLoading={this.state.meshData.isLoading}
                    isError={!!this.state.meshData.isError}
                    isMiniGraph={false}
                    namespaces={this.state.meshData.fetchParams.namespaces}
                    showIdleNodes={this.props.showIdleNodes}
                    toggleIdleNodes={this.props.toggleIdleNodes}
                  >
                    <GraphPF
                      focusNode={this.focusNode}
                      graphData={this.state.meshData}
                      isMiniGraph={false}
                      {...this.props}
                    />
                  </EmptyGraphLayout>
                </div>
              )}
            </ErrorBoundary>
            {this.props.target && (
              <SummaryPanel
                data={this.props.target}
                duration={this.state.meshData.fetchParams.duration}
                graphType={this.props.graphType}
                injectServiceNodes={this.props.showServiceNodes}
                isPageVisible={this.props.isPageVisible}
                namespaces={this.props.activeNamespaces}
                onFocus={this.onFocus}
                onLaunchWizard={this.handleLaunchWizard}
                onDeleteTrafficRouting={this.handleDeleteTrafficRouting}
                queryTime={this.state.meshData.timestamp / 1000}
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
          cluster={this.state.wizardsData.serviceDetails?.cluster || ''}
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
            onCancel={() => this.setState({ showConfirmDeleteTrafficRouting: false })}
            onConfirm={this.handleConfirmDeleteServiceTrafficRouting}
          />
        )}
      </>
    );
  }

  // TODO Focus...
  private onFocus = (focusNode: FocusNode) => {
    console.debug(`onFocus(${focusNode})`);
  };

  private handleEmptyGraphAction = () => {
    this.loadMeshFromBackend();
  };

  private handleMeshDataSourceSuccess = (
    graphTimestamp: TimeInSeconds,
    elements: DecoratedMeshElements,
    fetchParams: MeshFetchParams
  ) => {
    const prevElements = this.state.meshData.elements;
    this.setState({
      meshData: {
        elements: elements,
        elementsChanged: this.elementsChanged(prevElements, elements),
        isLoading: false,
        fetchParams: fetchParams,
        timestamp: graphTimestamp * 1000
      }
    });
    this.props.setMeshDefinition(this.meshDataSource.meshDefinition);
  };

  private handleMeshDataSourceError = (errorMessage: string | null, fetchParams: MeshFetchParams) => {
    const prevElements = this.state.meshData.elements;
    this.setState({
      meshData: {
        elements: EMPTY_GRAPH_DATA,
        elementsChanged: CytoscapeGraphUtils.elementsChanged(prevElements, EMPTY_GRAPH_DATA),
        errorMessage: !!errorMessage ? errorMessage : undefined,
        isError: true,
        isLoading: false,
        fetchParams: fetchParams,
        timestamp: Date.now()
      }
    });
  };

  private handleGraphDataSourceEmpty = (fetchParams: MeshFetchParams) => {
    const prevElements = this.state.meshData.elements;
    this.setState({
      meshData: {
        elements: EMPTY_GRAPH_DATA,
        elementsChanged: CytoscapeGraphUtils.elementsChanged(prevElements, EMPTY_GRAPH_DATA),
        isLoading: false,
        fetchParams: fetchParams,
        timestamp: Date.now()
      }
    });
  };

  private handleMeshDataSourceStart = (isPreviousDataInvalid: boolean, fetchParams: MeshFetchParams) => {
    this.setState({
      meshData: {
        elements: isPreviousDataInvalid ? EMPTY_GRAPH_DATA : this.state.meshData.elements,
        elementsChanged: false,
        fetchParams: fetchParams,
        isLoading: true,
        timestamp: isPreviousDataInvalid ? Date.now() : this.state.meshData.timestamp
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
  ) => {
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

  private handleWizardClose = (changed: boolean) => {
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

  private handleDeleteTrafficRouting = (_key: string, serviceDetail: ServiceDetailsInfo) => {
    this.setState(prevState => ({
      showConfirmDeleteTrafficRouting: true,
      wizardsData: {
        ...prevState.wizardsData,
        serviceDetails: serviceDetail
      }
    }));
  };

  private handleConfirmDeleteServiceTrafficRouting = () => {
    this.setState({
      showConfirmDeleteTrafficRouting: false
    });

    deleteServiceTrafficRouting(this.state.wizardsData!.serviceDetails!)
      .then(_results => {
        triggerRefresh();
      })
      .catch(error => {
        AlertUtils.addError('Could not delete Istio config objects.', error);
      });
  };

  private toggleHelp = () => {
    if (this.props.showLegend) {
      this.props.toggleLegend();
    }
    if (this.props.activeTour) {
      this.props.endTour();
    } else {
      const firstStop = getNextTourStop(GraphTourPF, -1, 'forward');
      this.props.startTour({ info: GraphTourPF, stop: firstStop });
    }
  };

  private loadMeshFromBackend = () => {
    const queryTime: TimeInMilliseconds | undefined = !!this.props.replayQueryTime
      ? this.props.replayQueryTime
      : undefined;

    this.meshDataSource.fetchGraphData({
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
      trafficRates: this.props.trafficRates
    });
  };

  private notifyError = (error: Error, _componentStack: string) => {
    AlertUtils.add(`There was an error when rendering the graph: ${error.message}, please try a different layout`);
  };

  private displayTimeRange = () => {
    const rangeEnd: TimeInMilliseconds = this.state.meshData.timestamp;
    const rangeStart: TimeInMilliseconds = rangeEnd - this.props.duration * 1000;

    return toRangeString(rangeStart, rangeEnd, { second: '2-digit' }, { second: '2-digit' });
  };

  // It is common that when updating the graph that the element topology (nodes, edges) remain the same,
  // only their activity changes (rates, etc). When the topology remains the same we may be able to optimize
  // some behavior.  This returns true if the topology changes, false otherwise.
  // 1) Quickly compare the number of nodes and edges, if different return true.
  // 2) Compare the ids
  private elementsChanged = (prevElements: DecoratedMeshElements, nextElements: DecoratedMeshElements): boolean => {
    if (prevElements === nextElements) {
      return false;
    }

    if (
      !prevElements ||
      !nextElements ||
      !prevElements.nodes ||
      !prevElements.edges ||
      !nextElements.nodes ||
      !nextElements.edges ||
      prevElements.nodes.length !== nextElements.nodes.length ||
      prevElements.edges.length !== nextElements.edges.length
    ) {
      return true;
    }

    return !(
      this.nodeOrEdgeArrayHasSameIds(nextElements.nodes, prevElements.nodes) &&
      this.nodeOrEdgeArrayHasSameIds(nextElements.edges, prevElements.edges)
    );
  };

  private nodeOrEdgeArrayHasSameIds = <T extends DecoratedMeshNodeWrapper | DecoratedMeshEdgeWrapper>(
    a: Array<T>,
    b: Array<T>
  ): boolean => {
    const aIds = a.map(e => e.data.id).sort();
    return b
      .map(e => e.data.id)
      .sort()
      .every((eId, index) => eId === aIds[index]);
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  activeTour: state.tourState.activeTour,
  findValue: findValueSelector(state),
  hideValue: hideValueSelector(state),
  istioAPIEnabled: state.statusState.istioEnvironment.istioAPIEnabled,
  isPageVisible: state.globalState.isPageVisible,
  kiosk: state.globalState.kiosk,
  layout: state.graph.layout,
  refreshInterval: refreshIntervalSelector(state),
  showLegend: state.graph.toolbarState.showLegend,
  summaryData: state.graph.summaryData
});

const mapDispatchToProps = (dispatch: KialiDispatch) => ({
  endTour: bindActionCreators(TourActions.endTour, dispatch),
  onReady: (controller: any) => dispatch(GraphThunkActions.graphPFReady(controller)),
  setMeshDefinition: bindActionCreators(MeshActions.setMeshDefinition, dispatch),
  setMeshLayout: bindActionCreators(MeshActions.setMeshLayout, dispatch),
  setMeshTarget: (target: MeshTarget) => dispatch(MeshActions.setMeshTarget(target)),
  setMeshUpdateTime: (val: TimeInMilliseconds) => dispatch(MeshActions.setMeshUpdateTime(val)),
  startTour: bindActionCreators(TourActions.startTour, dispatch),
  toggleLegend: bindActionCreators(GraphToolbarActions.toggleLegend, dispatch)
});

export const MeshPage = connectRefresh(connect(mapStateToProps, mapDispatchToProps)(MeshPageComponent));
