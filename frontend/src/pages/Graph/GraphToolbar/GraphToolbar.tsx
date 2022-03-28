import * as React from 'react';
import {
  Button,
  ButtonVariant,
  Toolbar,
  ToolbarGroup,
  ToolbarItem,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { bindActionCreators } from 'redux';
import { KialiAppState } from '../../../store/Store';
import {
  activeNamespacesSelector,
  edgeLabelsSelector,
  graphTypeSelector,
  showIdleNodesSelector,
  replayActiveSelector,
  trafficRatesSelector
} from '../../../store/Selectors';
import { GraphToolbarActions } from '../../../actions/GraphToolbarActions';
import { GraphType, NodeParamsType, EdgeLabelMode, SummaryData, TrafficRate, RankMode } from '../../../types/Graph';
import GraphFindContainer from './GraphFind';
import GraphSettingsContainer from './GraphSettings';
import history, { HistoryManager, URLParam } from '../../../app/History';
import Namespace, { namespacesFromString, namespacesToString } from '../../../types/Namespace';
import { NamespaceActions } from '../../../actions/NamespaceAction';
import { GraphActions } from '../../../actions/GraphActions';
import { KialiAppAction } from '../../../actions/KialiAppAction';
import { GraphTourStops } from 'pages/Graph/GraphHelpTour';
import TourStopContainer from 'components/Tour/TourStop';
import { KialiIcon, defaultIconStyle } from 'config/KialiIcon';
import ReplayContainer from 'components/Time/Replay';
import { UserSettingsActions } from 'actions/UserSettingsActions';
import GraphSecondaryMasthead from './GraphSecondaryMasthead';
import { CyNode } from 'components/CytoscapeGraph/CytoscapeGraphUtils';
import { INITIAL_USER_SETTINGS_STATE } from 'reducers/UserSettingsState';
import GraphResetContainer from './GraphReset';

type ReduxProps = {
  activeNamespaces: Namespace[];
  edgeLabels: EdgeLabelMode[];
  graphType: GraphType;
  node?: NodeParamsType;
  rankBy: RankMode[];
  replayActive: boolean;
  showIdleNodes: boolean;
  summaryData: SummaryData | null;
  trafficRates: TrafficRate[];

  setActiveNamespaces: (activeNamespaces: Namespace[]) => void;
  setEdgeLabels: (edgeLabels: EdgeLabelMode[]) => void;
  setGraphType: (graphType: GraphType) => void;
  setIdleNodes: (idleNodes: boolean) => void;
  setNode: (node?: NodeParamsType) => void;
  setRankBy: (rankLabels: RankMode[]) => void;
  setTrafficRates: (rates: TrafficRate[]) => void;
  toggleReplayActive: () => void;
};

type GraphToolbarProps = ReduxProps & {
  cy: any;
  disabled: boolean;
  elementsChanged: boolean;
  onToggleHelp: () => void;
  onRefresh?: () => void;
};

export class GraphToolbar extends React.PureComponent<GraphToolbarProps> {
  static contextTypes = {
    router: () => null
  };

  constructor(props: GraphToolbarProps) {
    super(props);
    // Let URL override current redux state at construction time. Update URL as needed.
    const urlParams = new URLSearchParams(history.location.search);

    const urlEdgeLabels = HistoryManager.getParam(URLParam.GRAPH_EDGE_LABEL, urlParams);
    if (!!urlEdgeLabels) {
      if (urlEdgeLabels !== props.edgeLabels.join(',')) {
        props.setEdgeLabels(urlEdgeLabels.split(',') as EdgeLabelMode[]);
      }
    } else if (props.setEdgeLabels.length > 0) {
      HistoryManager.setParam(URLParam.GRAPH_EDGE_LABEL, props.edgeLabels.join(','));
    }

    const urlRankLabels = HistoryManager.getParam(URLParam.GRAPH_RANK_BY, urlParams);
    if (!!urlRankLabels) {
      if (urlRankLabels !== props.rankBy.join(',')) {
        props.setRankBy(urlRankLabels.split(',') as RankMode[]);
      }
    } else if (props.setRankBy.length > 0) {
      HistoryManager.setParam(URLParam.GRAPH_RANK_BY, props.rankBy.join(','));
    }

    const urlReplayActive = HistoryManager.getBooleanParam(URLParam.GRAPH_REPLAY_ACTIVE);
    if (urlReplayActive !== undefined) {
      if (urlReplayActive !== this.props.replayActive) {
        this.props.toggleReplayActive();
      }
    } else if (this.props.replayActive !== INITIAL_USER_SETTINGS_STATE.replayActive) {
      HistoryManager.setParam(URLParam.GRAPH_REPLAY_ACTIVE, String(this.props.replayActive));
    }

    const urlGraphTraffic = HistoryManager.getParam(URLParam.GRAPH_TRAFFIC, urlParams);
    if (!!urlGraphTraffic) {
      if (urlGraphTraffic !== props.trafficRates.join(',')) {
        props.setTrafficRates(urlGraphTraffic.split(',') as TrafficRate[]);
      }
    } else if (props.trafficRates.length > 0) {
      HistoryManager.setParam(URLParam.GRAPH_TRAFFIC, props.trafficRates.join(','));
    }

    const urlGraphType = HistoryManager.getParam(URLParam.GRAPH_TYPE, urlParams) as GraphType;
    if (!!urlGraphType) {
      if (urlGraphType !== props.graphType) {
        props.setGraphType(urlGraphType);
      }
    } else {
      HistoryManager.setParam(URLParam.GRAPH_TYPE, String(this.props.graphType));
    }

    const urlNamespaces = HistoryManager.getParam(URLParam.NAMESPACES, urlParams);
    if (!!urlNamespaces) {
      if (urlNamespaces !== namespacesToString(props.activeNamespaces)) {
        props.setActiveNamespaces(namespacesFromString(urlNamespaces));
      }
    } else if (props.activeNamespaces.length > 0) {
      HistoryManager.setParam(URLParam.NAMESPACES, namespacesToString(props.activeNamespaces));
    }
  }

  componentDidUpdate() {
    // ensure redux state and URL are aligned
    if (this.props.edgeLabels?.length === 0) {
      HistoryManager.deleteParam(URLParam.GRAPH_EDGE_LABEL, true);
    } else {
      HistoryManager.setParam(URLParam.GRAPH_EDGE_LABEL, String(this.props.edgeLabels));
    }

    if (this.props.rankBy?.length === 0) {
      HistoryManager.deleteParam(URLParam.GRAPH_RANK_BY, true);
    } else {
      HistoryManager.setParam(URLParam.GRAPH_RANK_BY, String(this.props.rankBy));
    }

    if (this.props.activeNamespaces?.length === 0) {
      HistoryManager.deleteParam(URLParam.NAMESPACES, true);
    } else {
      HistoryManager.setParam(URLParam.NAMESPACES, namespacesToString(this.props.activeNamespaces));
    }

    if (this.props.replayActive === INITIAL_USER_SETTINGS_STATE.replayActive) {
      HistoryManager.deleteParam(URLParam.GRAPH_REPLAY_ACTIVE, true);
    } else {
      HistoryManager.setParam(URLParam.GRAPH_REPLAY_ACTIVE, String(this.props.replayActive));
    }

    if (this.props.trafficRates?.length === 0) {
      HistoryManager.deleteParam(URLParam.GRAPH_TRAFFIC, true);
    } else {
      HistoryManager.setParam(URLParam.GRAPH_TRAFFIC, String(this.props.trafficRates));
    }

    HistoryManager.setParam(URLParam.GRAPH_TYPE, String(this.props.graphType));
  }

  componentWillUnmount() {
    // If replay was left active then turn it off
    if (this.props.replayActive) {
      this.props.toggleReplayActive();
    }
  }

  render() {
    return (
      <>
        <GraphSecondaryMasthead
          disabled={this.props.disabled}
          graphType={this.props.graphType}
          isNodeGraph={!!this.props.node}
          onToggleHelp={this.props.onToggleHelp}
          onGraphTypeChange={this.props.setGraphType}
          onHandleRefresh={this.handleRefresh}
        />
        <Toolbar style={{ width: '100%' }}>
          <ToolbarGroup aria-label="graph settings" style={{ margin: 0 }}>
            {this.props.node && (
              <ToolbarItem style={{ margin: 0 }}>
                <Tooltip key={'graph-tour-help-ot'} position={TooltipPosition.right} content={'Back to full graph'}>
                  <Button variant={ButtonVariant.link} onClick={this.handleNamespaceReturn}>
                    <KialiIcon.Back className={defaultIconStyle} />
                  </Button>
                </Tooltip>
              </ToolbarItem>
            )}

            <ToolbarItem style={{ margin: 0 }}>
              <TourStopContainer info={GraphTourStops.Display}>
                <GraphSettingsContainer graphType={this.props.graphType} disabled={this.props.disabled} />
              </TourStopContainer>
            </ToolbarItem>

            <ToolbarItem>
              <GraphFindContainer cy={this.props.cy} elementsChanged={this.props.elementsChanged} />
            </ToolbarItem>

            <ToolbarItem style={{ marginLeft: 'auto' }}>
              <Tooltip key={'graph-tour-help-ot'} position={TooltipPosition.right} content="Shortcuts and tips...">
                <TourStopContainer info={GraphTourStops.Shortcuts}>
                  <Button
                    variant="link"
                    style={{ paddingLeft: '6px', paddingRight: '0px' }}
                    onClick={this.props.onToggleHelp}
                  >
                    <KialiIcon.Help className={defaultIconStyle} />
                  </Button>
                </TourStopContainer>
              </Tooltip>
              <GraphResetContainer />
            </ToolbarItem>
          </ToolbarGroup>
        </Toolbar>
        {this.props.replayActive && <ReplayContainer id="time-range-replay" />}
      </>
    );
  }

  private handleRefresh = () => {
    if (this.props.onRefresh) {
      this.props.onRefresh();
    }
  };

  private handleNamespaceReturn = () => {
    if (
      !this.props.summaryData ||
      (this.props.summaryData.summaryType !== 'node' && this.props.summaryData.summaryType !== 'box')
    ) {
      history.push(`/graph/namespaces`);
      return;
    }

    const selector = `node[id = "${this.props.summaryData!.summaryTarget.data(CyNode.id)}"]`;
    this.props.setNode(undefined);
    history.push(`/graph/namespaces?focusSelector=${encodeURI(selector)}`);
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state),
  edgeLabels: edgeLabelsSelector(state),
  graphType: graphTypeSelector(state),
  node: state.graph.node,
  rankBy: state.graph.toolbarState.rankBy,
  replayActive: replayActiveSelector(state),
  showIdleNodes: showIdleNodesSelector(state),
  summaryData: state.graph.summaryData,
  trafficRates: trafficRatesSelector(state)
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setActiveNamespaces: bindActionCreators(NamespaceActions.setActiveNamespaces, dispatch),
    setEdgeLabels: bindActionCreators(GraphToolbarActions.setEdgeLabels, dispatch),
    setGraphType: bindActionCreators(GraphToolbarActions.setGraphType, dispatch),
    setIdleNodes: bindActionCreators(GraphToolbarActions.setIdleNodes, dispatch),
    setNode: bindActionCreators(GraphActions.setNode, dispatch),
    setRankBy: bindActionCreators(GraphToolbarActions.setRankBy, dispatch),
    setTrafficRates: bindActionCreators(GraphToolbarActions.setTrafficRates, dispatch),
    toggleReplayActive: bindActionCreators(UserSettingsActions.toggleReplayActive, dispatch)
  };
};

const GraphToolbarContainer = connect(mapStateToProps, mapDispatchToProps)(GraphToolbar);

export default GraphToolbarContainer;
