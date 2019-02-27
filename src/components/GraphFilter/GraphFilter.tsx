import * as React from 'react';
import { Button, FormGroup, Toolbar } from 'patternfly-react';
import { style } from 'typestyle';
import * as _ from 'lodash';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { bindActionCreators } from 'redux';

import { KialiAppState } from '../../store/Store';
import { graphTypeSelector, edgeLabelModeSelector, activeNamespacesSelector } from '../../store/Selectors';
import { GraphFilterActions } from '../../actions/GraphFilterActions';

import { GraphType, NodeParamsType } from '../../types/Graph';
import { EdgeLabelMode } from '../../types/GraphFilter';

import GraphFindContainer from './GraphFind';
import GraphRefreshContainer from './GraphRefresh';
import GraphSettingsContainer from './GraphSettings';
import { HistoryManager, URLParams } from '../../app/History';
import { ListPagesHelper } from '../../components/ListPage/ListPagesHelper';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import Namespace, { namespacesToString, namespacesFromString } from '../../types/Namespace';
import { NamespaceActions } from '../../actions/NamespaceAction';
import { GraphActions } from '../../actions/GraphActions';
import { KialiAppAction } from '../../actions/KialiAppAction';

type ReduxProps = {
  activeNamespaces: Namespace[];
  edgeLabelMode: EdgeLabelMode;
  graphType: GraphType;
  node?: NodeParamsType;

  setActiveNamespaces: (activeNamespaces: Namespace[]) => void;
  setEdgeLabelMode: (edgeLabelMode: EdgeLabelMode) => void;
  setGraphType: (graphType: GraphType) => void;
  setNode: (node?: NodeParamsType) => void;
};

type GraphFilterProps = ReduxProps & {
  disabled: boolean;
  onRefresh: () => void;
};

const zeroPaddingLeft = style({
  marginLeft: '20px',
  paddingLeft: '0px'
});

const namespaceStyle = style({
  marginLeft: '-40px',
  marginRight: '5px'
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
    const urlEdgeLabelMode = ListPagesHelper.getSingleQueryParam(URLParams.GRAPH_EDGES) as EdgeLabelMode;
    if (urlEdgeLabelMode) {
      if (urlEdgeLabelMode !== props.edgeLabelMode) {
        props.setEdgeLabelMode(urlEdgeLabelMode);
      }
    } else {
      HistoryManager.setParam(URLParams.GRAPH_EDGES, String(this.props.edgeLabelMode));
    }

    const urlGraphType = ListPagesHelper.getSingleQueryParam(URLParams.GRAPH_TYPE) as GraphType;
    if (urlGraphType) {
      if (urlGraphType !== props.graphType) {
        props.setGraphType(urlGraphType);
      }
    } else {
      HistoryManager.setParam(URLParams.GRAPH_TYPE, String(this.props.graphType));
    }

    const urlNamespaces = ListPagesHelper.getSingleQueryParam(URLParams.NAMESPACES);
    if (urlNamespaces) {
      if (urlNamespaces !== namespacesToString(props.activeNamespaces)) {
        props.setActiveNamespaces(namespacesFromString(urlNamespaces));
      }
    } else {
      const activeNamespacesString = namespacesToString(props.activeNamespaces);
      HistoryManager.setParam(URLParams.NAMESPACES, activeNamespacesString);
    }
  }

  componentDidUpdate() {
    // ensure redux state and URL are aligned
    const activeNamespacesString = namespacesToString(this.props.activeNamespaces);
    if (this.props.activeNamespaces.length === 0) {
      HistoryManager.deleteParam(URLParams.NAMESPACES, true);
    } else {
      HistoryManager.setParam(URLParams.NAMESPACES, activeNamespacesString);
    }
    HistoryManager.setParam(URLParams.GRAPH_EDGES, String(this.props.edgeLabelMode));
    HistoryManager.setParam(URLParams.GRAPH_TYPE, String(this.props.graphType));
  }

  handleRefresh = () => {
    this.props.onRefresh();
  };

  handleNamespaceReturn = () => {
    this.props.setNode(undefined);
    this.context.router.history.push('/graph/namespaces');
  };

  render() {
    const graphTypeKey: string = _.findKey(GraphType, val => val === this.props.graphType)!;
    const edgeLabelModeKey: string = _.findKey(EdgeLabelMode, val => val === this.props.edgeLabelMode)!;
    return (
      <>
        <Toolbar>
          {this.props.node && (
            <FormGroup className={zeroPaddingLeft}>
              <Button className={namespaceStyle} onClick={this.handleNamespaceReturn}>
                Back to Full Graph...
              </Button>
            </FormGroup>
          )}
          <FormGroup className={zeroPaddingLeft}>
            <GraphSettingsContainer edgeLabelMode={this.props.edgeLabelMode} graphType={this.props.graphType} />
            <ToolbarDropdown
              id={'graph_filter_edge_labels'}
              disabled={false}
              handleSelect={this.setEdgeLabelMode}
              value={edgeLabelModeKey}
              label={GraphFilter.EDGE_LABEL_MODES[edgeLabelModeKey]}
              options={GraphFilter.EDGE_LABEL_MODES}
            />
            <ToolbarDropdown
              id={'graph_filter_view_type'}
              disabled={this.props.node !== undefined || this.props.disabled}
              handleSelect={this.setGraphType}
              value={graphTypeKey}
              label={GraphFilter.GRAPH_TYPES[graphTypeKey]}
              options={GraphFilter.GRAPH_TYPES}
            />
          </FormGroup>
          <GraphFindContainer />
          <Toolbar.RightContent>
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
  showFindHelp: state.graph.filterState.showFindHelp
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setActiveNamespaces: bindActionCreators(NamespaceActions.setActiveNamespaces, dispatch),
    setEdgeLabelMode: bindActionCreators(GraphFilterActions.setEdgelLabelMode, dispatch),
    setGraphType: bindActionCreators(GraphFilterActions.setGraphType, dispatch),
    setNode: bindActionCreators(GraphActions.setNode, dispatch),
    toggleFindHelp: bindActionCreators(GraphFilterActions.toggleFindHelp, dispatch)
  };
};

const GraphFilterContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(GraphFilter);

export default GraphFilterContainer;
