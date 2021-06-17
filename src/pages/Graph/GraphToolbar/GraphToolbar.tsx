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
  edgeLabelsSelector,
  graphTypeSelector,
  showIdleNodesSelector,
  replayActiveSelector
} from '../../../store/Selectors';
import { GraphToolbarActions } from '../../../actions/GraphToolbarActions';
import { GraphType, NodeParamsType, EdgeLabelMode, SummaryData } from '../../../types/Graph';
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

type ReduxProps = {
  activeNamespaces: Namespace[];
  edgeLabels: EdgeLabelMode[];
  graphType: GraphType;
  node?: NodeParamsType;
  replayActive: boolean;
  showIdleNodes: boolean;
  summaryData: SummaryData | null;

  setActiveNamespaces: (activeNamespaces: Namespace[]) => void;
  setEdgeLabels: (edgeLabels: EdgeLabelMode[]) => void;
  setGraphType: (graphType: GraphType) => void;
  setIdleNodes: (idleNodes: boolean) => void;
  setNode: (node?: NodeParamsType) => void;
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
    const urlEdgeLabels = HistoryManager.getParam(URLParam.GRAPH_EDGES, urlParams);
    if (urlEdgeLabels) {
      if (urlEdgeLabels !== props.edgeLabels.join(',')) {
        props.setEdgeLabels(urlEdgeLabels.split(',') as EdgeLabelMode[]);
      }
    } else {
      const edgeLabelsString = props.edgeLabels.join(',');
      HistoryManager.setParam(URLParam.NAMESPACES, edgeLabelsString);
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

    const idleNodes = HistoryManager.getBooleanParam(URLParam.GRAPH_IDLE_NODES);
    if (idleNodes !== undefined) {
      if (props.showIdleNodes !== idleNodes) {
        props.setIdleNodes(idleNodes);
      }
    } else {
      HistoryManager.setParam(URLParam.GRAPH_IDLE_NODES, String(this.props.showIdleNodes));
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
    HistoryManager.setParam(URLParam.GRAPH_EDGES, String(this.props.edgeLabels));
    HistoryManager.setParam(URLParam.GRAPH_TYPE, String(this.props.graphType));
    HistoryManager.setParam(URLParam.GRAPH_IDLE_NODES, String(this.props.showIdleNodes));
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
  edgeLabels: edgeLabelsSelector(state),
  graphType: graphTypeSelector(state),
  node: state.graph.node,
  replayActive: replayActiveSelector(state),
  showIdleNodes: showIdleNodesSelector(state),
  summaryData: state.graph.summaryData
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setActiveNamespaces: bindActionCreators(NamespaceActions.setActiveNamespaces, dispatch),
    setEdgeLabels: bindActionCreators(GraphToolbarActions.setEdgeLabels, dispatch),
    setGraphType: bindActionCreators(GraphToolbarActions.setGraphType, dispatch),
    setIdleNodes: bindActionCreators(GraphToolbarActions.setIdleNodes, dispatch),
    setNode: bindActionCreators(GraphActions.setNode, dispatch),
    toggleReplayActive: bindActionCreators(UserSettingsActions.toggleReplayActive, dispatch)
  };
};

const GraphToolbarContainer = connect(mapStateToProps, mapDispatchToProps)(GraphToolbar);

export default GraphToolbarContainer;
