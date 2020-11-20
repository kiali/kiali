import * as React from 'react';
import { Button, ButtonVariant, Toolbar, ToolbarGroup, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { style } from 'typestyle';
import * as _ from 'lodash';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { bindActionCreators } from 'redux';
import { KialiAppState } from '../../../store/Store';
import {
  activeNamespacesSelector,
  edgeLabelModeSelector,
  graphTypeSelector,
  showUnusedNodesSelector,
  replayActiveSelector
} from '../../../store/Selectors';
import { GraphToolbarActions } from '../../../actions/GraphToolbarActions';
import { GraphType, NodeParamsType, EdgeLabelMode } from '../../../types/Graph';
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

type ReduxProps = {
  activeNamespaces: Namespace[];
  edgeLabelMode: EdgeLabelMode;
  graphType: GraphType;
  node?: NodeParamsType;
  replayActive: boolean;
  showUnusedNodes: boolean;

  setActiveNamespaces: (activeNamespaces: Namespace[]) => void;
  setEdgeLabelMode: (edgeLabelMode: EdgeLabelMode) => void;
  setGraphType: (graphType: GraphType) => void;
  setNode: (node?: NodeParamsType) => void;
  setShowUnusedNodes: (unusedNodes: boolean) => void;
  toggleReplayActive: () => void;
};

type GraphToolbarProps = ReduxProps & {
  cy: any;
  disabled: boolean;
  onToggleHelp: () => void;
  onRefresh?: () => void;
};

const toolbarStyle = style({
  marginBottom: '20px',
  marginTop: '20px'
});

const rightToolbarStyle = style({
  marginLeft: 'auto'
});

export class GraphToolbar extends React.PureComponent<GraphToolbarProps> {
  /**
   *  Key-value pair object representation of EdgeLabelMode
   *
   *  Example:  EdgeLabelMode =>{'TRAFFIC_RATE_PER_SECOND': 'TrafficRatePerSecond'}
   */
  static readonly EDGE_LABEL_MODES = _.mapValues(_.omitBy(EdgeLabelMode, _.isFunction), val =>
    _.capitalize(_.startCase(val as EdgeLabelMode))
  );

  static contextTypes = {
    router: () => null
  };

  constructor(props: GraphToolbarProps) {
    super(props);
    // Let URL override current redux state at construction time. Update URL with unset params.
    const urlParams = new URLSearchParams(history.location.search);
    const urlEdgeLabelMode = HistoryManager.getParam(URLParam.GRAPH_EDGES, urlParams) as EdgeLabelMode;
    if (urlEdgeLabelMode) {
      if (urlEdgeLabelMode !== props.edgeLabelMode) {
        props.setEdgeLabelMode(urlEdgeLabelMode);
      }
    } else {
      HistoryManager.setParam(URLParam.GRAPH_EDGES, String(this.props.edgeLabelMode));
    }

    const urlGraphType = HistoryManager.getParam(URLParam.GRAPH_TYPE, urlParams) as GraphType;
    if (urlGraphType) {
      if (urlGraphType !== props.graphType) {
        props.setGraphType(urlGraphType);
      }
    } else {
      HistoryManager.setParam(URLParam.GRAPH_TYPE, String(this.props.graphType));
    }

    const urlNamespaces = HistoryManager.getParam(URLParam.NAMESPACES, urlParams);
    if (urlNamespaces) {
      if (urlNamespaces !== namespacesToString(props.activeNamespaces)) {
        props.setActiveNamespaces(namespacesFromString(urlNamespaces));
      }
    } else {
      const activeNamespacesString = namespacesToString(props.activeNamespaces);
      HistoryManager.setParam(URLParam.NAMESPACES, activeNamespacesString);
    }

    const unusedNodes = HistoryManager.getBooleanParam(URLParam.UNUSED_NODES);
    if (unusedNodes !== undefined) {
      if (props.showUnusedNodes !== unusedNodes) {
        props.setShowUnusedNodes(unusedNodes);
      }
    } else {
      HistoryManager.setParam(URLParam.UNUSED_NODES, String(this.props.showUnusedNodes));
    }
  }

  componentDidUpdate() {
    // ensure redux state and URL are aligned
    const activeNamespacesString = namespacesToString(this.props.activeNamespaces);
    if (this.props.activeNamespaces.length === 0) {
      HistoryManager.deleteParam(URLParam.NAMESPACES, true);
    } else {
      HistoryManager.setParam(URLParam.NAMESPACES, activeNamespacesString);
    }
    HistoryManager.setParam(URLParam.GRAPH_EDGES, String(this.props.edgeLabelMode));
    HistoryManager.setParam(URLParam.GRAPH_TYPE, String(this.props.graphType));
    HistoryManager.setParam(URLParam.UNUSED_NODES, String(this.props.showUnusedNodes));
  }

  componentWillUnmount() {
    // If replay was left active then turn it off
    if (this.props.replayActive) {
      this.props.toggleReplayActive();
    }
  }

  handleRefresh = () => {
    if (this.props.onRefresh) {
      this.props.onRefresh();
    }
  };

  handleNamespaceReturn = () => {
    this.props.setNode(undefined);
    history.push('/graph/namespaces');
  };

  render() {
    return (
      <>
        <GraphSecondaryMasthead
          disabled={this.props.disabled}
          graphType={this.props.graphType}
          onToggleHelp={this.props.onToggleHelp}
          onGraphTypeChange={this.props.setGraphType}
          onHandleRefresh={this.handleRefresh}
        />
        <Toolbar className={toolbarStyle}>
          <div style={{ display: 'flex' }}>
            {this.props.node && (
              <Tooltip key={'graph-tour-help-ot'} position={TooltipPosition.right} content={'Back to full graph'}>
                <Button variant={ButtonVariant.link} onClick={this.handleNamespaceReturn}>
                  <KialiIcon.Back className={defaultIconStyle} />
                </Button>
              </Tooltip>
            )}
            <TourStopContainer info={GraphTourStops.Display}>
              <GraphSettingsContainer graphType={this.props.graphType} />
            </TourStopContainer>
          </div>
          <GraphFindContainer cy={this.props.cy} />
          <ToolbarGroup className={rightToolbarStyle} aria-label="graph_refresh_toolbar">
            <Tooltip key={'graph-tour-help-ot'} position={TooltipPosition.right} content="Graph help tour...">
              <Button
                className={rightToolbarStyle}
                variant="link"
                style={{ paddingLeft: '6px', paddingRight: '0px' }}
                onClick={this.props.onToggleHelp}
              >
                <KialiIcon.Help className={defaultIconStyle} />
                {' Graph tour'}
              </Button>
            </Tooltip>
          </ToolbarGroup>
        </Toolbar>
        {this.props.replayActive && <ReplayContainer id={'time-range-replay'} />}
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state),
  edgeLabelMode: edgeLabelModeSelector(state),
  graphType: graphTypeSelector(state),
  node: state.graph.node,
  replayActive: replayActiveSelector(state),
  showUnusedNodes: showUnusedNodesSelector(state)
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setActiveNamespaces: bindActionCreators(NamespaceActions.setActiveNamespaces, dispatch),
    setEdgeLabelMode: bindActionCreators(GraphToolbarActions.setEdgelLabelMode, dispatch),
    setGraphType: bindActionCreators(GraphToolbarActions.setGraphType, dispatch),
    setNode: bindActionCreators(GraphActions.setNode, dispatch),
    setShowUnusedNodes: bindActionCreators(GraphToolbarActions.setShowUnusedNodes, dispatch),
    toggleReplayActive: bindActionCreators(UserSettingsActions.toggleReplayActive, dispatch)
  };
};

const GraphToolbarContainer = connect(mapStateToProps, mapDispatchToProps)(GraphToolbar);

export default GraphToolbarContainer;
