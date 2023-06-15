import * as React from 'react';
import { connect } from 'react-redux';
import {
  Card,
  CardActions,
  CardBody,
  CardHeader,
  CardTitle,
  Dropdown,
  DropdownItem,
  KebabToggle,
  ToolbarItem
} from '@patternfly/react-core';
import history from '../../app/History';
import GraphDataSource from '../../services/GraphDataSource';
import { DecoratedGraphElements, EdgeMode, GraphEvent, GraphType, Layout, NodeType } from '../../types/Graph';
import { GraphUrlParams, makeNodeGraphUrlFromParams } from 'components/Nav/NavUtils';
import { store } from 'store/ConfigStore';
import { TimeInMilliseconds } from '../../types/Common';
import { ServiceDetailsInfo } from '../../types/ServiceInfo';
import { KialiAppState } from '../../store/Store';
import GraphPF from './GraphPF';
import { WizardAction, WizardMode } from 'components/IstioWizards/WizardActions';
import { isParentKiosk } from 'components/Kiosk/KioskActions';
import { LoadingWizardActionsDropdownGroup } from 'components/IstioWizards/LoadingWizardActionsDropdownGroup';
import ServiceWizardActionsDropdownGroup from 'components/IstioWizards/ServiceWizardActionsDropdownGroup';
import { toRangeString } from 'components/Time/Utils';
import { KioskElement } from 'components/Kiosk/KioskElement';
import TimeDurationIndicatorContainer from 'components/Time/TimeDurationIndicatorComponent';
import { TimeDurationModal } from 'components/Time/TimeDurationModal';
import { KialiDagreGraph } from 'components/CytoscapeGraph/graphs/KialiDagreGraph';
import { KialiDispatch } from 'types/Redux';
import GraphThunkActions from 'actions/GraphThunkActions';
import { bindActionCreators } from 'redux';
import { GraphActions } from 'actions/GraphActions';

// const initGraphContainerStyle = style({ width: '100%', height: '100%' });

type ReduxProps = {
  kiosk: string;
  onReady: (controller: any) => void;
  setEdgeMode: (edgeMode: EdgeMode) => void;
  setLayout: (layout: Layout) => void;
  setUpdateTime: (val: TimeInMilliseconds) => void;
  updateSummary: (event: GraphEvent) => void;
};

type MiniGraphCardPropsPF = ReduxProps & {
  dataSource: GraphDataSource;
  // graphContainerStyle?: string;
  onDeleteTrafficRouting?: (key: string) => void;
  //onEdgeTap?: (e: GraphEdgeTapEvent) => void;
  onLaunchWizard?: (key: WizardAction, mode: WizardMode) => void;
  serviceDetails?: ServiceDetailsInfo | null;
};

type MiniGraphCardState = {
  isKebabOpen: boolean;
  isTimeOptionsOpen: boolean;
  graphData: DecoratedGraphElements;
};

class MiniGraphCardPF extends React.Component<MiniGraphCardPropsPF, MiniGraphCardState> {
  //private cytoscapeGraphRef: any;

  constructor(props) {
    super(props);
    //this.cytoscapeGraphRef = React.createRef();
    this.state = { isKebabOpen: false, isTimeOptionsOpen: false, graphData: props.dataSource.graphData };
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
      </DropdownItem>
    ];
    if (isParentKiosk(this.props.kiosk)) {
      if (this.props.serviceDetails === undefined) {
        graphCardActions.push(<LoadingWizardActionsDropdownGroup />);
      } else if (this.props.serviceDetails) {
        graphCardActions.push(
          <ServiceWizardActionsDropdownGroup
            virtualServices={this.props.serviceDetails.virtualServices || []}
            destinationRules={this.props.serviceDetails.destinationRules || []}
            k8sHTTPRoutes={this.props.serviceDetails.k8sHTTPRoutes || []}
            istioPermissions={this.props.serviceDetails.istioPermissions}
            onAction={this.handleLaunchWizard}
            onDelete={this.handleDeleteTrafficRouting}
          />
        );
      }
    } else {
      graphCardActions.push(
        <DropdownItem key="viewNodeGraph" onClick={this.onViewNodeGraph}>
          Show node graph
        </DropdownItem>
      );
    }

    const rangeEnd: TimeInMilliseconds = this.props.dataSource.graphTimestamp * 1000;
    const rangeStart: TimeInMilliseconds = rangeEnd - this.props.dataSource.graphDuration * 1000;
    const intervalTitle =
      rangeEnd > 0 ? toRangeString(rangeStart, rangeEnd, { second: '2-digit' }, { second: '2-digit' }) : 'Loading';

    return (
      <>
        <Card style={{ height: '100%' }} id={'MiniGraphCard'} data-test="mini-graph">
          <CardHeader>
            <CardActions>
              <KioskElement>
                <ToolbarItem>
                  <TimeDurationIndicatorContainer onClick={this.toggleTimeOptionsVisibility} isDuration={true} />
                </ToolbarItem>
              </KioskElement>
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
              <GraphPF
                //containerClassName={
                //  this.props.graphContainerStyle ? this.props.graphContainerStyle : initGraphContainerStyle
                //}
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
                //toggleIdleNodes={() => undefined}
                isMiniGraph={true}
                //onEdgeTap={this.props.onEdgeTap}
                layout={KialiDagreGraph.getLayout()}
                //onNodeTap={this.handleNodeTap}
                // Ranking not enabled for minigraphs yet
                //rankBy={[]}
                //ref={refInstance => this.setCytoscapeGraph(refInstance)}
                //refreshInterval={0}
                //setRankResult={undefined}
                //showIdleEdges={false}
                onReady={this.props.onReady}
                setEdgeMode={this.props.setEdgeMode}
                setLayout={this.props.setLayout}
                setUpdateTime={this.props.setUpdateTime}
                updateSummary={this.props.updateSummary}
                showMissingSidecars={true}
                //showOperationNodes={false}
                //showRank={false}
                showSecurity={true}
                //showServiceNodes={true}
                showTrafficAnimation={false}
                //showIdleNodes={false}
                showVirtualServices={true}
                //summaryData={null}
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

  private handleLaunchWizard = (key: WizardAction, mode: WizardMode) => {
    this.onGraphActionsToggle(false);
    if (this.props.onLaunchWizard) {
      this.props.onLaunchWizard(key, mode);
    }
  };

  private handleDeleteTrafficRouting = (key: string) => {
    this.onGraphActionsToggle(false);
    if (this.props.onDeleteTrafficRouting) {
      this.props.onDeleteTrafficRouting(key);
    }
  };

  /*
  private handleNodeTap = (e: GraphNodeTapEvent) => {
    // Do nothing on inaccessible nodes or service entry nodes
    if (e.isInaccessible || e.isServiceEntry) {
      return;
    }

    // If we are already on the details page of the tapped node, do nothing.
    const displayedNode = this.props.dataSource.fetchParameters.node!;
    // Minigraph will consider box nodes as app
    const eNodeType = e.nodeType === 'box' && e.isBox ? e.isBox : e.workload ? 'workload' : e.nodeType;
    const isSameResource =
      displayedNode.namespace.name === e.namespace &&
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

    let href = `/namespaces/${e.namespace}/${resourceType}s/${resource}`;

    if (e.cluster) {
      href = href + '?cluster=' + e.cluster;
    }

    if (isParentKiosk(this.props.kiosk)) {
      kioskContextMenuAction(href);
    } else {
      history.push(href);
    }
  };
  */

  private onGraphActionsToggle = (isOpen: boolean) => {
    this.setState({
      isKebabOpen: isOpen
    });
  };

  private onViewFullGraph = () => {
    /*
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

    if (isParentKiosk(this.props.kiosk)) {
      kioskContextMenuAction(graphUrl);
    } else {
      history.push(graphUrl);
    }
    */
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

  private toggleTimeOptionsVisibility = () => {
    this.setState(prevState => ({ isTimeOptionsOpen: !prevState.isTimeOptionsOpen }));
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  kiosk: state.globalState.kiosk
});

const mapDispatchToProps = (dispatch: KialiDispatch) => ({
  onReady: (controller: any) => dispatch(GraphThunkActions.graphPFReady(controller)),
  setEdgeMode: bindActionCreators(GraphActions.setEdgeMode, dispatch),
  setLayout: bindActionCreators(GraphActions.setLayout, dispatch),
  setUpdateTime: (val: TimeInMilliseconds) => dispatch(GraphActions.setUpdateTime(val)),
  updateSummary: (event: GraphEvent) => dispatch(GraphActions.updateSummary(event))
});

const MiniGraphCardPFContainer = connect(mapStateToProps, mapDispatchToProps)(MiniGraphCardPF);
export default MiniGraphCardPFContainer;
