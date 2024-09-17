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
import { DecoratedGraphElements, EdgeMode, GraphEvent, GraphType, Layout, NodeType } from '../../types/Graph';
import { GraphUrlParams, makeNodeGraphUrlFromParams } from 'components/Nav/NavUtils';
import { store } from 'store/ConfigStore';
import { TimeInMilliseconds } from '../../types/Common';
import { ServiceDetailsInfo } from '../../types/ServiceInfo';
import { KialiAppState } from '../../store/Store';
import { GraphPF } from './GraphPF';
import { WizardAction, WizardMode } from 'components/IstioWizards/WizardActions';
import { isParentKiosk, kioskContextMenuAction } from 'components/Kiosk/KioskActions';
import { ServiceWizardActionsDropdownGroup } from 'components/IstioWizards/ServiceWizardActionsDropdownGroup';
import { toRangeString } from 'components/Time/Utils';
import { KioskElement } from 'components/Kiosk/KioskElement';
import { TimeDurationIndicator } from 'components/Time/TimeDurationIndicator';
import { TimeDurationModal } from 'components/Time/TimeDurationModal';
import { KialiDagreGraph } from 'components/CytoscapeGraph/graphs/KialiDagreGraph';
import { KialiDispatch } from 'types/Redux';
import { GraphThunkActions } from 'actions/GraphThunkActions';
import { bindActionCreators } from 'redux';
import { GraphActions } from 'actions/GraphActions';
import { GraphSelectorBuilder } from 'pages/Graph/GraphSelector';
import { NodeData, elems, selectAnd } from './GraphPFElems';
import { KialiIcon } from 'config/KialiIcon';
import { kebabToggleStyle } from 'styles/DropdownStyles';
import { WorkloadWizardActionsDropdownGroup } from 'components/IstioWizards/WorkloadWizardActionsDropdownGroup';
import { Workload } from 'types/Workload';

type ReduxDispatchProps = {
  onReady: (controller: any) => void;
  setEdgeMode: (edgeMode: EdgeMode) => void;
  setLayout: (layout: Layout) => void;
  setUpdateTime: (val: TimeInMilliseconds) => void;
  updateSummary: (event: GraphEvent) => void;
};

type ReduxProps = ReduxDispatchProps & {
  kiosk: string;
};

type MiniGraphCardPropsPF = ReduxProps & {
  dataSource: GraphDataSource;
  namespace?: string;
  onDeleteTrafficRouting?: (key: string) => void;
  onLaunchWizard?: (key: WizardAction, mode: WizardMode) => void;
  refreshWorkload?: () => void;
  serviceDetails?: ServiceDetailsInfo | null;
  workload?: Workload | null;
};

type MiniGraphCardState = {
  graphData: DecoratedGraphElements;
  isKebabOpen: boolean;
  isTimeOptionsOpen: boolean;
};

class MiniGraphCardPFComponent extends React.Component<MiniGraphCardPropsPF, MiniGraphCardState> {
  constructor(props: MiniGraphCardPropsPF) {
    super(props);
    this.state = { isKebabOpen: false, isTimeOptionsOpen: false, graphData: props.dataSource.graphData };
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
    this.setState({ graphData: this.props.dataSource.graphData });
  };

  render(): React.ReactNode {
    const graphCardActions = [
      <DropdownItem key="viewFullGraph" onClick={this.onViewFullGraph}>
        Show full graph
      </DropdownItem>,
      <DropdownItem key="viewNodeGraph" onClick={this.onViewNodeGraph}>
        Show node graph
      </DropdownItem>
    ];

    if (isParentKiosk(this.props.kiosk)) {
      if (this.props.workload && this.props.namespace) {
        graphCardActions.push(
          <WorkloadWizardActionsDropdownGroup
            actionsLabel={true}
            namespace={this.props.namespace}
            onAction={this.handleWorkloadAction}
            workload={this.props.workload}
          ></WorkloadWizardActionsDropdownGroup>
        );
      } else if (this.props.serviceDetails) {
        graphCardActions.push(
          <ServiceWizardActionsDropdownGroup
            virtualServices={this.props.serviceDetails.virtualServices ?? []}
            destinationRules={this.props.serviceDetails.destinationRules ?? []}
            k8sGRPCRoutes={this.props.serviceDetails.k8sGRPCRoutes ?? []}
            k8sHTTPRoutes={this.props.serviceDetails.k8sHTTPRoutes ?? []}
            istioPermissions={this.props.serviceDetails.istioPermissions}
            onAction={this.handleLaunchWizard}
            onDelete={this.handleDeleteTrafficRouting}
          />
        );
      }
    }

    const rangeEnd: TimeInMilliseconds = this.props.dataSource.graphTimestamp * 1000;
    const rangeStart: TimeInMilliseconds = rangeEnd - this.props.dataSource.graphDuration * 1000;

    const intervalTitle =
      rangeEnd > 0 ? toRangeString(rangeStart, rangeEnd, { second: '2-digit' }, { second: '2-digit' }) : 'Loading';

    return (
      <>
        <Card style={{ height: '100%' }} id={'MiniGraphCard'} data-test="mini-graph">
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

          <CardBody>
            <div style={{ height: '100%' }}>
              <GraphPF
                edgeLabels={this.props.dataSource.fetchParameters.edgeLabels}
                edgeMode={EdgeMode.ALL}
                graphData={{
                  elements: this.state.graphData,
                  elementsChanged: true,
                  errorMessage: !!this.props.dataSource.errorMessage ? this.props.dataSource.errorMessage : undefined,
                  isError: this.props.dataSource.isError,
                  isLoading: this.props.dataSource.isLoading,
                  fetchParams: this.props.dataSource.fetchParameters,
                  timestamp: this.props.dataSource.graphTimestamp
                }}
                isMiniGraph={true}
                layout={KialiDagreGraph.getLayout()}
                onEdgeTap={this.handleEdgeTap}
                onNodeTap={this.handleNodeTap}
                onReady={this.props.onReady}
                setEdgeMode={this.props.setEdgeMode}
                setLayout={this.props.setLayout}
                setUpdateTime={this.props.setUpdateTime}
                updateSummary={this.props.updateSummary}
                showOutOfMesh={true}
                showSecurity={true}
                showTrafficAnimation={false}
                showVirtualServices={true}
              />
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

    // Minigraph will consider box nodes as app
    const eNodeType = data.nodeType === 'box' && data.isBox ? data.isBox : data.workload ? 'workload' : data.nodeType;

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
      href = `${href}?cluster=${data.cluster}`;
    }

    if (isParentKiosk(this.props.kiosk)) {
      kioskContextMenuAction(href);
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
    const namespace = this.props.dataSource.fetchParameters.namespaces[0].name;
    let graphSelector = new GraphSelectorBuilder().namespace(namespace);
    let graphType: GraphType = GraphType.APP;

    switch (this.props.dataSource.fetchParameters.node!.nodeType) {
      case NodeType.AGGREGATE:
        graphSelector = graphSelector
          .aggregate(
            this.props.dataSource.fetchParameters.node!.aggregate!,
            this.props.dataSource.fetchParameters.node!.aggregateValue!
          )
          .nodeType(NodeType.AGGREGATE);
        break;
      case NodeType.APP:
        graphSelector = graphSelector.app(this.props.dataSource.fetchParameters.node!.app).nodeType(NodeType.APP);
        break;
      case NodeType.SERVICE:
        graphType = GraphType.SERVICE;
        graphSelector = graphSelector.service(this.props.dataSource.fetchParameters.node!.service);
        break;
      case NodeType.WORKLOAD:
        graphType = GraphType.WORKLOAD;
        graphSelector = graphSelector.workload(this.props.dataSource.fetchParameters.node!.workload);
        break;
      default:
        // NodeType.BOX is n/a
        break;
    }

    const graphUrl = `/graphpf/namespaces?graphType=${graphType}&injectServiceNodes=true&namespaces=${namespace}&focusSelector=${encodeURI(
      graphSelector.build()
    )}`;

    if (isParentKiosk(this.props.kiosk)) {
      kioskContextMenuAction(graphUrl);
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
      showWaypoints: this.props.dataSource.fetchParameters.showWaypoints,
      trafficRates: this.props.dataSource.fetchParameters.trafficRates
    };

    // To ensure updated components get the updated URL, update the URL first and then the state
    if (isParentKiosk(this.props.kiosk)) {
      kioskContextMenuAction(makeNodeGraphUrlFromParams(urlParams, true));
    } else {
      router.navigate(makeNodeGraphUrlFromParams(urlParams, true));
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
  onReady: (controller: any) => dispatch(GraphThunkActions.graphPFReady(controller)),
  setEdgeMode: bindActionCreators(GraphActions.setEdgeMode, dispatch),
  setLayout: bindActionCreators(GraphActions.setLayout, dispatch),
  setUpdateTime: (val: TimeInMilliseconds) => dispatch(GraphActions.setUpdateTime(val)),
  updateSummary: (event: GraphEvent) => dispatch(GraphActions.updateSummary(event))
});

export const MiniGraphCardPF = connect(mapStateToProps, mapDispatchToProps)(MiniGraphCardPFComponent);
