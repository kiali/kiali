import * as React from 'react';
import { connect } from 'react-redux';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleElement,
  ToolbarItem
} from '@patternfly/react-core';
import { Edge, EdgeModel, Node, NodeModel } from '@patternfly/react-topology';
import { URLParam, location, router } from '../../app/History';
import { GraphDataSource } from '../../services/GraphDataSource';
import {
  DecoratedGraphElements,
  EdgeMode,
  SummaryData,
  GraphLayout,
  GraphType,
  NodeType,
  UNKNOWN
} from '../../types/Graph';
import { GraphUrlParams, makeNodeGraphUrlFromParams } from 'components/Nav/NavUtils';
import { store } from 'store/ConfigStore';
import { TimeInMilliseconds } from '../../types/Common';
import { ServiceDetailsInfo } from '../../types/ServiceInfo';
import { KialiAppState } from '../../store/Store';
import { Graph } from './Graph';
import { WizardAction, WizardMode } from 'components/IstioWizards/WizardActions';
import { isKiosk, isParentKiosk, kioskNavigateAction } from 'components/Kiosk/KioskActions';
import { ServiceWizardActionsDropdownGroup } from 'components/IstioWizards/ServiceWizardActionsDropdownGroup';
import { toRangeString } from 'components/Time/Utils';
import { KioskElement } from 'components/Kiosk/KioskElement';
import { TimeDurationIndicator } from 'components/Time/TimeDurationIndicator';
import { TimeDurationModal } from 'components/Time/TimeDurationModal';
import { KialiDispatch } from 'types/Redux';
import { bindActionCreators } from 'redux';
import { GraphActions } from 'actions/GraphActions';
import { NodeData } from './GraphElems';
import { elems, selectAnd } from 'helpers/GraphHelpers';
import { KialiIcon } from 'config/KialiIcon';
import { kebabToggleStyle } from 'styles/DropdownStyles';
import { WorkloadWizardActionsDropdownGroup } from 'components/IstioWizards/WorkloadWizardActionsDropdownGroup';
import { Workload } from 'types/Workload';
import { NamespaceAction } from 'pages/Namespaces/NamespaceActions';
import { NamespaceActionsDropdownGroup } from 'pages/Namespaces/NamespaceActionsDropdownGroup';
import { GraphRefs } from './GraphPage';
import { EmptyGraphLayout } from 'pages/Graph/EmptyGraphLayout';
import { kialiStyle } from 'styles/StyleUtils';

const cardStyle = kialiStyle({
  height: '100%',
  display: 'flex',
  flexDirection: 'column'
});

const cardBodyStyle = kialiStyle({
  flex: '1 1 auto',
  display: 'flex',
  flexDirection: 'column'
});

const graphContainerStyle = kialiStyle({
  flex: '1 1 auto',
  display: 'flex',
  flexDirection: 'column'
});

type ReduxDispatchProps = {
  setEdgeMode: (edgeMode: EdgeMode) => void;
  setLayout: (layout: GraphLayout) => void;
  setUpdateTime: (val: TimeInMilliseconds) => void;
  updateSummary: (summaryData: SummaryData) => void;
};

type ReduxProps = ReduxDispatchProps & {
  kiosk: string;
};

type MiniGraphCardProps = ReduxProps & {
  dataSource: GraphDataSource;
  namespace?: string;
  namespaceActions?: NamespaceAction[];
  onDeleteTrafficRouting?: (key: string) => void;
  onLaunchWizard?: (key: WizardAction, mode: WizardMode) => void;
  refreshWorkload?: () => void;
  serviceDetails?: ServiceDetailsInfo | null;
  workload?: Workload | null;
};

type MiniGraphCardState = {
  graphData: DecoratedGraphElements;
  graphRefs?: GraphRefs;
  isKebabOpen: boolean;
  isLoading: boolean;
  isReady: boolean;
  isTimeOptionsOpen: boolean;
};

class MiniGraphCardComponent extends React.Component<MiniGraphCardProps, MiniGraphCardState> {
  constructor(props: MiniGraphCardProps) {
    super(props);
    this.state = {
      isKebabOpen: false,
      isLoading: props.dataSource.isLoading,
      isReady: false,
      isTimeOptionsOpen: false,
      graphData: props.dataSource.graphData
    };
  }

  componentDidMount(): void {
    this.props.dataSource.on('fetchSuccess', this.refresh);
    this.props.dataSource.on('fetchError', this.refresh);
  }

  componentWillUnmount(): void {
    this.props.dataSource.removeListener('fetchSuccess', this.refresh);
    this.props.dataSource.removeListener('fetchError', this.refresh);
  }

  private refresh = (): void => {
    this.setState({ graphData: this.props.dataSource.graphData, isLoading: this.props.dataSource.isLoading });
  };

  render(): React.ReactNode {
    const hasNode =
      this.props.dataSource.fetchParameters.node &&
      this.props.dataSource.fetchParameters.node.nodeType !== NodeType.UNKNOWN;

    const graphCardActions = [
      <DropdownItem key="viewFullGraph" onClick={this.onViewFullGraph}>
        Show full graph
      </DropdownItem>
    ];

    if (hasNode) {
      graphCardActions.push(
        <DropdownItem key="viewNodeGraph" onClick={this.onViewNodeGraph}>
          Show node graph
        </DropdownItem>
      );
    }

    if (isKiosk(this.props.kiosk)) {
      if (this.props.workload && this.props.namespace) {
        graphCardActions.push(
          <WorkloadWizardActionsDropdownGroup
            key="workloadActions"
            actionsLabel={true}
            namespace={this.props.namespace}
            onAction={this.handleWorkloadAction}
            workload={this.props.workload}
          ></WorkloadWizardActionsDropdownGroup>
        );
      } else if (this.props.serviceDetails) {
        graphCardActions.push(
          <ServiceWizardActionsDropdownGroup
            key="serviceActions"
            virtualServices={this.props.serviceDetails.virtualServices ?? []}
            destinationRules={this.props.serviceDetails.destinationRules ?? []}
            k8sGRPCRoutes={this.props.serviceDetails.k8sGRPCRoutes ?? []}
            k8sHTTPRoutes={this.props.serviceDetails.k8sHTTPRoutes ?? []}
            istioPermissions={this.props.serviceDetails.istioPermissions}
            onAction={this.handleLaunchWizard}
            onDelete={this.handleDeleteTrafficRouting}
          />
        );
      } else if (this.props.namespaceActions && this.props.namespaceActions.length > 0) {
        graphCardActions.push(
          <NamespaceActionsDropdownGroup
            key="namespaceActions"
            actions={this.props.namespaceActions}
            namespace={this.props.dataSource.fetchParameters.namespaces[0]?.name ?? ''}
            onAction={() => this.onGraphActionsToggle(false)}
          />
        );
      }
    }

    // The parent component supplies the datasource and the target element. Here we protect against a lifecycle issue where the two
    // can be out of sync. If so, just assume the parent is currently loading until things get synchronized.
    const isLoading =
      (this.props.workload && this.props.workload?.name !== this.props.dataSource.fetchParameters.node?.workload) ||
      (this.props.serviceDetails &&
        this.props.serviceDetails?.service.name !== this.props.dataSource.fetchParameters.node?.service)
        ? true
        : this.props.dataSource.isLoading;

    const rangeEnd: TimeInMilliseconds = this.props.dataSource.graphTimestamp * 1000;
    const rangeStart: TimeInMilliseconds = rangeEnd - this.props.dataSource.graphDuration * 1000;

    const intervalTitle =
      rangeEnd > 0 ? toRangeString(rangeStart, rangeEnd, { second: '2-digit' }, { second: '2-digit' }) : 'Loading';

    return (
      <>
        <Card id={'MiniGraphCard'} data-test="mini-graph" className={cardStyle}>
          <CardHeader
            actions={{
              actions: (
                <>
                  <KioskElement>
                    <ToolbarItem>
                      <TimeDurationIndicator onClick={this.toggleTimeOptionsVisibility} isDuration={true} />
                    </ToolbarItem>
                  </KioskElement>
                  <Dropdown
                    toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                      <MenuToggle
                        id="minigraph-toggle"
                        ref={toggleRef}
                        className={kebabToggleStyle}
                        aria-label="Actions"
                        variant="plain"
                        onClick={() => this.onGraphActionsToggle(!this.state.isKebabOpen)}
                        isExpanded={this.state.isKebabOpen}
                      >
                        <KialiIcon.KebabToggle />
                      </MenuToggle>
                    )}
                    isOpen={this.state.isKebabOpen}
                    onOpenChange={(isOpen: boolean) => this.onGraphActionsToggle(isOpen)}
                    popperProps={{ position: 'right' }}
                  >
                    <DropdownList>{graphCardActions}</DropdownList>
                  </Dropdown>
                </>
              ),
              hasNoOffset: false,
              className: undefined
            }}
          >
            <CardTitle style={{ float: 'left' }}>{intervalTitle}</CardTitle>
          </CardHeader>

          <CardBody className={cardBodyStyle}>
            <div id="pft-graph" className={graphContainerStyle}>
              <EmptyGraphLayout
                elements={this.state.graphData}
                isLoading={isLoading}
                isError={this.props.dataSource.isError}
                isMiniGraph={true}
                loaded={true}
              >
                <Graph
                  edgeLabels={this.props.dataSource.fetchParameters.edgeLabels}
                  edgeMode={EdgeMode.ALL}
                  graphData={{
                    elements: this.state.graphData,
                    elementsChanged: true,
                    errorMessage: !!this.props.dataSource.errorMessage ? this.props.dataSource.errorMessage : undefined,
                    isError: this.props.dataSource.isError,
                    isLoading: isLoading,
                    loaded: true,
                    fetchParams: this.props.dataSource.fetchParameters,
                    timestamp: this.props.dataSource.graphTimestamp
                  }}
                  isMiniGraph={true}
                  layout={GraphLayout.Dagre}
                  onDeleteTrafficRouting={this.handleDeleteTrafficRouting}
                  onEdgeTap={this.handleEdgeTap}
                  onLaunchWizard={this.handleLaunchWizard}
                  onNodeTap={this.handleNodeTap}
                  onReady={this.handleReady}
                  rankBy={[]}
                  setEdgeMode={this.props.setEdgeMode}
                  setLayout={this.props.setLayout}
                  setRankResult={() => {}}
                  setUpdateTime={this.props.setUpdateTime}
                  updateSummary={this.props.updateSummary}
                  showLegend={false}
                  showRank={false}
                  showOutOfMesh={true}
                  showSecurity={true}
                  showTrafficAnimation={false}
                  showVirtualServices={true}
                />
              </EmptyGraphLayout>
            </div>
          </CardBody>
        </Card>

        <TimeDurationModal
          customDuration={false}
          isOpen={this.state.isTimeOptionsOpen}
          onConfirm={this.toggleTimeOptionsVisibility}
          onCancel={this.toggleTimeOptionsVisibility}
        />
      </>
    );
  }

  private handleReady = (refs: GraphRefs | undefined, isReady: boolean): void => {
    this.setState({ graphRefs: refs, isReady: isReady });
  };

  private handleLaunchWizard = (key: WizardAction, mode: WizardMode): void => {
    this.onGraphActionsToggle(false);
    if (this.props.onLaunchWizard) {
      this.props.onLaunchWizard(key, mode);
    }
  };

  private handleDeleteTrafficRouting = (key: string): void => {
    this.onGraphActionsToggle(false);
    if (this.props.onDeleteTrafficRouting) {
      this.props.onDeleteTrafficRouting(key);
    }
  };

  private handleWorkloadAction = (): void => {
    this.onGraphActionsToggle(false);
    if (this.props.refreshWorkload) {
      this.props.refreshWorkload();
    }
  };

  private handleEdgeTap = (edge: Edge<EdgeModel>): void => {
    const source = edge.getSource();
    const sourceData = source.getData() as NodeData;
    const target = edge.getTarget();
    const targetData = target.getData() as NodeData;

    const selected = selectAnd(elems(source.getController()).nodes, [{ prop: 'isSelected', op: 'truthy' }]);

    if (selected.length === 0) {
      return;
    }

    const nodeData = selected[0].getData();
    const nodeApp = nodeData.app;
    const nodeService = nodeData.service;
    const nodeType = nodeData.nodeType;

    if (source.getId() !== target.getId()) {
      const urlParams = new URLSearchParams(location.getSearch());

      switch (nodeType) {
        case NodeType.APP: {
          const isInbound = targetData.app === nodeApp;
          const destination = isInbound ? 'source_canonical_service' : 'destination_canonical_service';
          urlParams.set('tab', isInbound ? 'in_metrics' : 'out_metrics');
          urlParams.set(URLParam.BY_LABELS, `${destination}=${isInbound ? sourceData.app : targetData.app}`);
          break;
        }
        case NodeType.SERVICE: {
          const isInbound = targetData.service === nodeService;
          const destination = isInbound ? 'source_canonical_service' : 'destination_canonical_service';
          urlParams.set('tab', 'metrics');
          urlParams.set(URLParam.BY_LABELS, `${destination}=${isInbound ? sourceData.app : targetData.app}`);
          break;
        }
        case NodeType.WORKLOAD: {
          const isInbound = targetData.app === nodeApp;
          const destination = isInbound ? 'source_canonical_service' : 'destination_canonical_service';
          urlParams.set('tab', isInbound ? 'in_metrics' : 'out_metrics');
          urlParams.set(URLParam.BY_LABELS, `${destination}=${isInbound ? sourceData.app : targetData.app}`);
        }
      }

      router.navigate(`${location.getPathname()}?&{urlParams.toString()}`, { replace: true });
    }
  };

  private handleNodeTap = (node: Node<NodeModel>): void => {
    const data = node.getData() as NodeData;

    // Do nothing on inaccessible nodes or service entry nodes
    if (data.isInaccessible || data.isServiceEntry) {
      return;
    }

    // If we are already on the details page of the tapped node, do nothing.
    const displayedNode = this.props.dataSource.fetchParameters.node!;

    // Box: use inner type (e.g. app). Versioned-app leaf (app + version + workload) opens workload detail; aggregate app
    // nodes (no concrete version) open application detail even when workload is set on the node (graph/types.go).
    const useWorkloadTarget =
      data.nodeType === NodeType.WORKLOAD ||
      (data.nodeType === NodeType.APP && !!data.workload && !!data.version && data.version !== UNKNOWN);

    const eNodeType =
      data.nodeType === NodeType.BOX && data.isBox ? data.isBox : useWorkloadTarget ? NodeType.WORKLOAD : data.nodeType;

    const isSameResource =
      displayedNode.namespace.name === data.namespace &&
      displayedNode.nodeType === eNodeType &&
      displayedNode[displayedNode.nodeType] === data[eNodeType];

    if (isSameResource) {
      return;
    }

    // unselect the currently selected node
    (node as any).selected = false;

    // Redirect to the details page of the tapped node.
    let resource = data[eNodeType];
    let resourceType: string = eNodeType === NodeType.APP ? 'application' : eNodeType;

    let href = `/namespaces/${data.namespace}/${resourceType}s/${resource}`;

    if (data.cluster) {
      href = `${href}?clusterName=${data.cluster}`;
    }

    if (isParentKiosk(this.props.kiosk)) {
      kioskNavigateAction(href);
    } else {
      router.navigate(href);
    }
  };

  private onGraphActionsToggle = (isOpen: boolean): void => {
    this.setState({
      isKebabOpen: isOpen
    });
  };

  private onViewFullGraph = (): void => {
    const namespace = this.props.dataSource.fetchParameters.namespaces[0];
    const graphType: GraphType = this.props.dataSource.fetchParameters.graphType;

    const selected = selectAnd(elems(this.state.graphRefs!.getController()).nodes, [
      { prop: 'isSelected', op: 'truthy' }
    ]);

    const params = new URLSearchParams();
    params.set('graphType', graphType);
    params.set('injectServiceNodes', 'true');
    params.set('namespaces', namespace.name);
    if (namespace.cluster) {
      params.set(URLParam.CLUSTERNAME, namespace.cluster);
    }
    if (selected.length > 0) {
      params.set(URLParam.FOCUS_SELECTOR, selected[0].getId());
    }

    const graphUrl = `/graph/namespaces?${params.toString()}`;

    if (isParentKiosk(this.props.kiosk)) {
      kioskNavigateAction(graphUrl);
    } else {
      router.navigate(graphUrl);
    }
  };

  private onViewNodeGraph = (): void => {
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
      showVirtualServices: true,
      showWaypoints: this.props.dataSource.fetchParameters.showWaypoints,
      trafficRates: this.props.dataSource.fetchParameters.trafficRates
    };

    // To ensure updated components get the updated URL, update the URL first and then the state
    if (isParentKiosk(this.props.kiosk)) {
      kioskNavigateAction(makeNodeGraphUrlFromParams(urlParams));
    } else {
      router.navigate(makeNodeGraphUrlFromParams(urlParams));
    }
  };

  private toggleTimeOptionsVisibility = (): void => {
    this.setState(prevState => ({ isTimeOptionsOpen: !prevState.isTimeOptionsOpen }));
  };
}

const mapStateToProps = (state: KialiAppState): { kiosk: string } => ({
  kiosk: state.globalState.kiosk
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => ({
  setEdgeMode: bindActionCreators(GraphActions.setEdgeMode, dispatch),
  setLayout: bindActionCreators(GraphActions.setLayout, dispatch),
  setUpdateTime: (val: TimeInMilliseconds) => dispatch(GraphActions.setUpdateTime(val)),
  updateSummary: (summaryData: SummaryData) => dispatch(GraphActions.updateSummary(summaryData))
});

export const MiniGraphCard = connect(mapStateToProps, mapDispatchToProps)(MiniGraphCardComponent);
