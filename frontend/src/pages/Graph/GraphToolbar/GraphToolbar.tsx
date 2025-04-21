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
import { GraphSettings } from './GraphSettings';
import { GraphType, NodeParamsType, EdgeLabelMode, SummaryData, TrafficRate, RankMode } from '../../../types/Graph';
import { router, HistoryManager, URLParam, location } from '../../../app/History';
import { Namespace, namespacesFromString, namespacesToString } from '../../../types/Namespace';
import { KialiDispatch } from '../../../types/Redux';
import { NamespaceActions } from '../../../actions/NamespaceAction';
import { GraphActions } from '../../../actions/GraphActions';
import { GraphTourStops } from 'pages/Graph/GraphHelpTour';
import { TourStop } from 'components/Tour/TourStop';
import { KialiIcon } from 'config/KialiIcon';
import { Replay } from 'components/Time/Replay';
import { UserSettingsActions } from 'actions/UserSettingsActions';
import { GraphSecondaryMasthead } from './GraphSecondaryMasthead';
import { INITIAL_USER_SETTINGS_STATE } from 'reducers/UserSettingsState';
import { GraphReset } from './GraphReset';
import { GraphFind } from './GraphFind';
import { kialiStyle } from 'styles/StyleUtils';
import { isParentKiosk, kioskContextMenuAction } from 'components/Kiosk/KioskActions';

type ReduxStateProps = {
  activeNamespaces: Namespace[];
  edgeLabels: EdgeLabelMode[];
  graphType: GraphType;
  kiosk: string;
  node?: NodeParamsType;
  rankBy: RankMode[];
  replayActive: boolean;
  showIdleNodes: boolean;
  summaryData: SummaryData | null;
  trafficRates: TrafficRate[];
};

type ReduxDispatchProps = {
  setActiveNamespaces: (activeNamespaces: Namespace[]) => void;
  setEdgeLabels: (edgeLabels: EdgeLabelMode[]) => void;
  setGraphType: (graphType: GraphType) => void;
  setIdleNodes: (idleNodes: boolean) => void;
  setNode: (node?: NodeParamsType) => void;
  setRankBy: (rankLabels: RankMode[]) => void;
  setTrafficRates: (rates: TrafficRate[]) => void;
  toggleReplayActive: () => void;
};

type ReduxProps = ReduxStateProps & ReduxDispatchProps;

type GraphToolbarProps = ReduxProps & {
  controller?: any;
  disabled: boolean;
  elementsChanged: boolean;
  onToggleHelp: () => void;
};

const helpStyle = kialiStyle({
  marginRight: '0.5rem',
  alignSelf: 'center'
});

class GraphToolbarComponent extends React.PureComponent<GraphToolbarProps> {
  static contextTypes = {
    router: () => null
  };

  constructor(props: GraphToolbarProps) {
    super(props);
    // Let URL override current redux state at construction time. Update URL as needed.
    const urlParams = new URLSearchParams(location.getSearch());

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

  componentDidUpdate(prevProps: GraphToolbarProps): void {
    // ensure redux state and URL are aligned
    if (String(prevProps.edgeLabels) !== String(this.props.edgeLabels)) {
      if (this.props.edgeLabels?.length === 0) {
        HistoryManager.deleteParam(URLParam.GRAPH_EDGE_LABEL);
      } else {
        HistoryManager.setParam(URLParam.GRAPH_EDGE_LABEL, String(this.props.edgeLabels));
      }
    }

    if (String(prevProps.rankBy) !== String(this.props.rankBy)) {
      if (this.props.rankBy?.length === 0) {
        HistoryManager.deleteParam(URLParam.GRAPH_RANK_BY);
      } else {
        HistoryManager.setParam(URLParam.GRAPH_RANK_BY, String(this.props.rankBy));
      }
    }

    if (namespacesToString(prevProps.activeNamespaces) !== namespacesToString(this.props.activeNamespaces)) {
      if (this.props.activeNamespaces?.length === 0) {
        HistoryManager.deleteParam(URLParam.NAMESPACES);
      } else {
        HistoryManager.setParam(URLParam.NAMESPACES, namespacesToString(this.props.activeNamespaces));
      }
    }

    if (String(prevProps.replayActive) !== String(this.props.replayActive)) {
      if (this.props.replayActive === INITIAL_USER_SETTINGS_STATE.replayActive) {
        HistoryManager.deleteParam(URLParam.GRAPH_REPLAY_ACTIVE);
      } else {
        HistoryManager.setParam(URLParam.GRAPH_REPLAY_ACTIVE, String(this.props.replayActive));
      }
    }

    if (String(prevProps.trafficRates) !== String(this.props.trafficRates)) {
      if (this.props.trafficRates?.length === 0) {
        HistoryManager.deleteParam(URLParam.GRAPH_TRAFFIC);
      } else {
        HistoryManager.setParam(URLParam.GRAPH_TRAFFIC, String(this.props.trafficRates));
      }
    }

    if (prevProps.graphType !== this.props.graphType) {
      HistoryManager.setParam(URLParam.GRAPH_TYPE, String(this.props.graphType));
    }
  }

  componentWillUnmount(): void {
    // If replay was left active then turn it off
    if (this.props.replayActive) {
      this.props.toggleReplayActive();
    }
  }

  render(): React.ReactNode {
    return (
      <>
        <GraphSecondaryMasthead
          disabled={this.props.disabled}
          graphType={this.props.graphType}
          isNodeGraph={!!this.props.node}
          onGraphTypeChange={this.props.setGraphType}
        />
        <Toolbar style={{ width: '100%' }}>
          <ToolbarGroup aria-label="graph settings" style={{ margin: 0, alignItems: 'flex-start' }}>
            {this.props.node && (
              <ToolbarItem style={{ margin: 0 }}>
                <Tooltip key={'graph-tour-help-ot'} position={TooltipPosition.right} content={'Back to full graph'}>
                  <Button variant={ButtonVariant.link} onClick={this.handleNamespaceReturn}>
                    <KialiIcon.Back />
                  </Button>
                </Tooltip>
              </ToolbarItem>
            )}

            <ToolbarItem style={{ margin: 0 }}>
              <TourStop info={GraphTourStops.Display}>
                <GraphSettings graphType={this.props.graphType} disabled={this.props.disabled} />
              </TourStop>
            </ToolbarItem>

            <ToolbarItem>
              <GraphFind controller={this.props.controller} elementsChanged={this.props.elementsChanged} />
            </ToolbarItem>

            <ToolbarItem style={{ marginLeft: 'auto', alignSelf: 'center' }}>
              <Tooltip key={'graph-tour-help-ot'} position={TooltipPosition.right} content="Shortcuts and tips...">
                <TourStop info={GraphTourStops.Shortcuts}>
                  <Button
                    id="graph-tour"
                    variant={ButtonVariant.link}
                    className={helpStyle}
                    onClick={this.props.onToggleHelp}
                    isInline
                  >
                    <KialiIcon.Help />
                    <span style={{ marginLeft: '5px' }}>Help</span>
                  </Button>
                </TourStop>
              </Tooltip>
              <GraphReset />
            </ToolbarItem>
          </ToolbarGroup>
        </Toolbar>
        {this.props.replayActive && <Replay id="time-range-replay" />}
      </>
    );
  }

  private handleNamespaceReturn = (): void => {
    const route = 'graph';
    if (
      !this.props.summaryData ||
      (this.props.summaryData.summaryType !== 'node' && this.props.summaryData.summaryType !== 'box')
    ) {
      const returnUrl = `/${route}/namespaces`;

      if (isParentKiosk(this.props.kiosk)) {
        kioskContextMenuAction(returnUrl);
      } else {
        router.navigate(returnUrl);
      }

      return;
    }

    const selector = this.props.summaryData!.summaryTarget.getId();

    this.props.setNode(undefined);

    const returnUrl = `/${route}/namespaces?${URLParam.FOCUS_SELECTOR}=${encodeURI(selector)}`;

    if (isParentKiosk(this.props.kiosk)) {
      kioskContextMenuAction(returnUrl);
    } else {
      router.navigate(returnUrl);
    }
  };
}

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  activeNamespaces: activeNamespacesSelector(state),
  edgeLabels: edgeLabelsSelector(state),
  graphType: graphTypeSelector(state),
  kiosk: state.globalState.kiosk,
  node: state.graph.node,
  rankBy: state.graph.toolbarState.rankBy,
  replayActive: replayActiveSelector(state),
  showIdleNodes: showIdleNodesSelector(state),
  summaryData: state.graph.summaryData,
  trafficRates: trafficRatesSelector(state)
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => {
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

export const GraphToolbar = connect(mapStateToProps, mapDispatchToProps)(GraphToolbarComponent);
