import * as React from 'react';
import { connect } from 'react-redux';
import { DurationInSeconds } from '../../types/Common';
import { GraphParamsType, GraphType, NodeParamsType } from '../../types/Graph';
import { EdgeLabelMode } from '../../types/GraphFilter';
import GraphFilterToolbarType from '../../types/GraphFilterToolbar';
import Namespace from '../../types/Namespace';
import { makeNamespaceGraphUrlFromParams, makeNodeGraphUrlFromParams } from '../Nav/NavUtils';
import { GraphDataThunkActions } from '../../actions/GraphDataActions';
import GraphFilter from '../../components/GraphFilter/GraphFilter';
import { KialiAppState } from '../../store/Store';
import { activeNamespaceSelector, durationSelector } from '../../store/Selectors';

export class GraphFilterToolbar extends React.PureComponent<GraphFilterToolbarType> {
  static contextTypes = {
    router: () => null
  };

  render() {
    const graphParams: GraphParamsType = {
      edgeLabelMode: this.props.edgeLabelMode,
      graphLayout: this.props.graphLayout,
      graphType: this.props.graphType,
      injectServiceNodes: this.props.injectServiceNodes,
      node: this.props.node
    };

    return (
      <GraphFilter
        disabled={this.props.isLoading}
        onNamespaceReturn={this.handleNamespaceReturn}
        onGraphTypeChange={this.handleGraphTypeChange}
        onEdgeLabelModeChange={this.handleEdgeLabelModeChange}
        onRefresh={this.props.handleRefreshClick}
        {...graphParams}
      />
    );
  }

  handleNamespaceReturn = () => {
    // TODO: This should be handled by a redux action that sets the node to undefined
    this.context.router.history.push(makeNamespaceGraphUrlFromParams({ ...this.getGraphParams(), node: undefined }));
  };

  handleGraphTypeChange = (graphType: GraphType) => {
    this.handleUrlFilterChange({
      ...this.getGraphParams(),
      graphType
    });
  };

  handleEdgeLabelModeChange = (edgeLabelMode: EdgeLabelMode) => {
    this.handleUrlFilterChange({
      ...this.getGraphParams(),
      edgeLabelMode
    });

    if (edgeLabelMode === EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE) {
      // Server-side appender for response time is not run by default unless the edge label is explicitly set. So when switching
      // to this edge label, we need to make a server-side request in order to ensure the appenders is run.
      this.props.fetchGraphData(
        this.props.activeNamespace,
        this.props.duration,
        this.props.graphType,
        this.props.injectServiceNodes,
        edgeLabelMode,
        this.props.showSecurity,
        this.props.showUnusedNodes,
        this.props.node
      );
    }
  };

  handleUrlFilterChange = (params: GraphParamsType) => {
    if (this.props.node) {
      this.context.router.history.push(makeNodeGraphUrlFromParams(params));
    } else {
      this.context.router.history.push(makeNamespaceGraphUrlFromParams(params));
    }
  };

  private getGraphParams: () => GraphParamsType = () => {
    return {
      edgeLabelMode: this.props.edgeLabelMode,
      graphLayout: this.props.graphLayout,
      graphType: this.props.graphType,
      injectServiceNodes: this.props.injectServiceNodes,
      node: this.props.node
    };
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespace: activeNamespaceSelector(state),
  duration: durationSelector(state)
});

const mapDispatchToProps = (dispatch: any) => ({
  fetchGraphData: (
    namespace: Namespace,
    duration: DurationInSeconds,
    graphType: GraphType,
    injectServiceNodes: boolean,
    edgeLabelMode: EdgeLabelMode,
    showSecurity: boolean,
    showUnusedNodes: boolean,
    node?: NodeParamsType
  ) =>
    dispatch(
      GraphDataThunkActions.fetchGraphData(
        namespace,
        duration,
        graphType,
        injectServiceNodes,
        edgeLabelMode,
        showSecurity,
        showUnusedNodes,
        node
      )
    )
});

const GraphFilterToolbarContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(GraphFilterToolbar);
export default GraphFilterToolbarContainer;
