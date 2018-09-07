import * as React from 'react';
import { PropTypes } from 'prop-types';

import { GraphParamsType, GraphType } from '../../types/Graph';
import { Duration } from '../../types/GraphFilter';
import Namespace from '../../types/Namespace';
import GraphFilterToolbarType from '../../types/GraphFilterToolbar';

import { makeNamespaceGraphUrlFromParams, makeNodeGraphUrlFromParams } from '../Nav/NavUtils';

import GraphFilter from './GraphFilter';

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
    this.handleFilterChange({
      ...this.getGraphParams(),
      namespace
    });
  };

  handleNamespaceReturn = () => {
    this.context.router.history.push(
      makeNamespaceGraphUrlFromParams({ ...this.getGraphParams(), node: undefined, injectServiceNodes: false })
    );
  };

  handleGraphTypeChange = (graphType: GraphType) => {
    this.handleFilterChange({
      ...this.getGraphParams(),
      graphType
    });
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
