import * as React from 'react';

import { GraphParamsType, GraphType } from '../../types/Graph';
import { Duration, EdgeLabelMode } from '../../types/GraphFilter';
import GraphFilterToolbarType from '../../types/GraphFilterToolbar';
import { store } from '../../store/ConfigStore';
import { makeNamespaceGraphUrlFromParams, makeNodeGraphUrlFromParams } from '../Nav/NavUtils';
import { GraphActions } from '../../actions/GraphActions';
import { GraphDataActions } from '../../actions/GraphDataActions';
import GraphFilterContainer from '../../containers/GraphFilterContainer';

export default class GraphFilterToolbar extends React.PureComponent<GraphFilterToolbarType> {
  static contextTypes = {
    router: () => null
  };

  render() {
    const graphParams: GraphParamsType = {
      node: this.props.node,
      graphLayout: this.props.graphLayout,
      graphDuration: this.props.graphDuration,
      edgeLabelMode: this.props.edgeLabelMode,
      graphType: this.props.graphType,
      injectServiceNodes: this.props.injectServiceNodes
    };

    return (
      <GraphFilterContainer
        disabled={this.props.isLoading}
        onDurationChange={this.handleDurationChange}
        onNamespaceReturn={this.handleNamespaceReturn}
        onGraphTypeChange={this.handleGraphTypeChange}
        onEdgeLabelModeChange={this.handleEdgeLabelModeChange}
        onRefresh={this.props.handleRefreshClick}
        {...graphParams}
      />
    );
  }

  handleDurationChange = (graphDuration: Duration) => {
    this.handleUrlFilterChange({
      ...this.getGraphParams(),
      graphDuration
    });
  };

  handleNamespaceReturn = () => {
    // TODO: This should be handled by a redux action that sets the node to undefined
    this.context.router.history.push(makeNamespaceGraphUrlFromParams({ ...this.getGraphParams(), node: undefined }));
  };

  handleGraphTypeChange = (graphType: GraphType) => {
    store.dispatch(GraphActions.changed());
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
      store.dispatch(
        // @ts-ignore
        GraphDataActions.fetchGraphData(
          store.getState().namespaces.activeNamespace,
          this.props.graphDuration,
          this.props.graphType,
          this.props.injectServiceNodes,
          edgeLabelMode,
          this.props.showSecurity,
          this.props.showUnusedNodes,
          this.props.node
        )
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
      node: this.props.node,
      graphDuration: this.props.graphDuration,
      graphLayout: this.props.graphLayout,
      edgeLabelMode: this.props.edgeLabelMode,
      graphType: this.props.graphType,
      injectServiceNodes: this.props.injectServiceNodes
    };
  };
}
