import * as React from 'react';
import { Button, FormGroup, Toolbar } from 'patternfly-react';
import { style } from 'typestyle';
import * as _ from 'lodash';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { bindActionCreators } from 'redux';

import { KialiAppState } from '../../store/Store';
import {
  activeNamespacesSelector,
  edgeLabelModeSelector,
  graphTypeSelector,
  showUnusedNodesSelector
} from '../../store/Selectors';
import { GraphFilterActions } from '../../actions/GraphFilterActions';

import { GraphType, NodeParamsType } from '../../types/Graph';
import { EdgeLabelMode } from '../../types/GraphFilter';

import GraphFindContainer from './GraphFind';
import GraphRefreshContainer from './GraphRefresh';
import GraphSettingsContainer from './GraphSettings';
import history, { HistoryManager, URLParam } from '../../app/History';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import Namespace, { namespacesFromString, namespacesToString } from '../../types/Namespace';
import { NamespaceActions } from '../../actions/NamespaceAction';
import { GraphActions } from '../../actions/GraphActions';
import { KialiAppAction } from '../../actions/KialiAppAction';
import { AlignRightStyle, ThinStyle } from '../../components/Filters/FilterStyles';

type ReduxProps = {
  activeNamespaces: Namespace[];
  edgeLabelMode: EdgeLabelMode;
  graphType: GraphType;
  node?: NodeParamsType;
  showUnusedNodes: boolean;

  setActiveNamespaces: (activeNamespaces: Namespace[]) => void;
  setEdgeLabelMode: (edgeLabelMode: EdgeLabelMode) => void;
  setGraphType: (graphType: GraphType) => void;
  setNode: (node?: NodeParamsType) => void;
  setShowUnusedNodes: (unusedNodes: boolean) => void;
};

type GraphFilterProps = ReduxProps & {
  disabled: boolean;
  onRefresh: () => void;
};

// align with separator start / Graph breadcrumb
const alignLeftStyle = style({
  marginLeft: '-30px'
});

export class GraphFilter extends React.PureComponent<GraphFilterProps> {
  /**
   *  Key-value pair object representation of GraphType enum.  Values are human-readable versions of enum keys.
   *
   *  Example:  GraphType => {'APP': 'App', 'VERSIONED_APP': 'VersionedApp'}
   */
  static readonly GRAPH_TYPES = _.mapValues(GraphType, val => `${_.capitalize(_.startCase(val))} graph`);

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

  constructor(props: GraphFilterProps) {
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

  handleRefresh = () => {
    this.props.onRefresh();
  };

  handleNamespaceReturn = () => {
    this.props.setNode(undefined);
    history.push('/graph/namespaces');
  };

  // TODO [jshaughn] Is there a better typescript way than the style attribute with the spread syntax (here and other places)
  render() {
    const graphTypeKey: string = _.findKey(GraphType, val => val === this.props.graphType)!;
    const edgeLabelModeKey: string = _.findKey(EdgeLabelMode, val => val === this.props.edgeLabelMode)!;
    return (
      <>
        <Toolbar>
          <FormGroup className={alignLeftStyle} style={{ ...ThinStyle }}>
            {this.props.node ? (
              <Button onClick={this.handleNamespaceReturn}>Back to full {GraphFilter.GRAPH_TYPES[graphTypeKey]}</Button>
            ) : (
              <ToolbarDropdown
                id={'graph_filter_view_type'}
                disabled={this.props.disabled}
                handleSelect={this.setGraphType}
                value={graphTypeKey}
                label={GraphFilter.GRAPH_TYPES[graphTypeKey]}
                options={GraphFilter.GRAPH_TYPES}
              />
            )}
            <ToolbarDropdown
              id={'graph_filter_edge_labels'}
              disabled={false}
              handleSelect={this.setEdgeLabelMode}
              value={edgeLabelModeKey}
              label={GraphFilter.EDGE_LABEL_MODES[edgeLabelModeKey]}
              options={GraphFilter.EDGE_LABEL_MODES}
            />
            <GraphSettingsContainer edgeLabelMode={this.props.edgeLabelMode} graphType={this.props.graphType} />
          </FormGroup>
          <GraphFindContainer />
          <Toolbar.RightContent style={{ ...AlignRightStyle }}>
            <GraphRefreshContainer
              id="graph_refresh_container"
              disabled={this.props.disabled}
              handleRefresh={this.handleRefresh}
            />
          </Toolbar.RightContent>
        </Toolbar>
      </>
    );
  }

  private setGraphType = (type: string) => {
    const graphType: GraphType = GraphType[type] as GraphType;
    if (this.props.graphType !== graphType) {
      this.props.setGraphType(graphType);
    }
  };

  private setEdgeLabelMode = (edgeMode: string) => {
    const mode: EdgeLabelMode = EdgeLabelMode[edgeMode] as EdgeLabelMode;
    if (this.props.edgeLabelMode !== mode) {
      this.props.setEdgeLabelMode(mode);
    }
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state),
  edgeLabelMode: edgeLabelModeSelector(state),
  graphType: graphTypeSelector(state),
  node: state.graph.node,
  showUnusedNodes: showUnusedNodesSelector(state)
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setActiveNamespaces: bindActionCreators(NamespaceActions.setActiveNamespaces, dispatch),
    setEdgeLabelMode: bindActionCreators(GraphFilterActions.setEdgelLabelMode, dispatch),
    setGraphType: bindActionCreators(GraphFilterActions.setGraphType, dispatch),
    setNode: bindActionCreators(GraphActions.setNode, dispatch),
    setShowUnusedNodes: bindActionCreators(GraphFilterActions.setShowUnusedNodes, dispatch)
  };
};

const GraphFilterContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(GraphFilter);

export default GraphFilterContainer;
