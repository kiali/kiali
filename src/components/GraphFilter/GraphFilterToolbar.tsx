import * as React from 'react';
import { PropTypes } from 'prop-types';

import { GraphParamsType, GraphType } from '../../types/Graph';
import { Duration, EdgeLabelMode } from '../../types/GraphFilter';
import Namespace from '../../types/Namespace';
import GraphFilterToolbarType from '../../types/GraphFilterToolbar';
import { store } from '../../store/ConfigStore';
import { makeNamespaceGraphUrlFromParams, makeNodeGraphUrlFromParams } from '../Nav/NavUtils';
import GraphFilter from './GraphFilter';
import { GraphActions } from '../../actions/GraphActions';
import { GraphDataActions } from '../../actions/GraphDataActions';

export default class GraphFilterToolbar extends React.PureComponent<GraphFilterToolbarType> {
  static contextTypes = {
    router: PropTypes.object
  };

  render() {
    const graphParams: GraphParamsType = {
      namespace: this.props.namespace,
      node: this.props.node,
      graphLayout: this.props.graphLayout,
      graphDuration: this.props.graphDuration,
      edgeLabelMode: this.props.edgeLabelMode,
      graphType: this.props.graphType,
      injectServiceNodes: this.props.injectServiceNodes
    };

    return (
      <GraphFilter
        disabled={this.props.isLoading}
        onDurationChange={this.handleDurationChange}
        onNamespaceChange={this.handleNamespaceChange}
        onNamespaceReturn={this.handleNamespaceReturn}
        onGraphTypeChange={this.handleGraphTypeChange}
        onEdgeLabelModeChange={this.handleEdgeLabelModeChange}
        onRefresh={this.props.handleRefreshClick}
        {...graphParams}
      />
    );
  }

  handleDurationChange = (graphDuration: Duration) => {
    this.handleFilterChange({
      ...this.getGraphParams(),
      graphDuration
    });
  };

  handleNamespaceChange = (namespace: Namespace) => {
    store.dispatch(GraphActions.namespaceChanged(namespace.name));
    this.handleFilterChange({
      ...this.getGraphParams(),
      namespace
    });
  };

  handleNamespaceReturn = () => {
    this.context.router.history.push(makeNamespaceGraphUrlFromParams({ ...this.getGraphParams(), node: undefined }));
  };

  handleGraphTypeChange = (graphType: GraphType) => {
    this.handleFilterChange({
      ...this.getGraphParams(),
      graphType
    });
  };

  handleEdgeLabelModeChange = (edgeLabelMode: EdgeLabelMode) => {
    this.handleFilterChange({
      ...this.getGraphParams(),
      edgeLabelMode
    });

    if (edgeLabelMode === EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE || edgeLabelMode === EdgeLabelMode.MTLS_ENABLED) {
      // Server-side appenders for security and response time are not run by default unless those edge labels are specifically requested.
      // So when switching to these edge labels, we have to ensure we make a server-side request in order to ensure those appenders are run.
      store.dispatch(
        // @ts-ignore
        GraphDataActions.fetchGraphData(
          this.props.namespace,
          this.props.graphDuration,
          this.props.graphType,
          this.props.injectServiceNodes,
          edgeLabelMode,
          this.props.node
        )
      );
    }
  };

  handleFilterChange = (params: GraphParamsType) => {
    if (this.props.node) {
      this.context.router.history.push(makeNodeGraphUrlFromParams(this.props.node, params));
    } else {
      this.context.router.history.push(makeNamespaceGraphUrlFromParams(params));
    }
  };

  private getGraphParams: () => GraphParamsType = () => {
    return {
      namespace: this.props.namespace,
      node: this.props.node,
      graphDuration: this.props.graphDuration,
      graphLayout: this.props.graphLayout,
      edgeLabelMode: this.props.edgeLabelMode,
      graphType: this.props.graphType,
      injectServiceNodes: this.props.injectServiceNodes
    };
  };
}
