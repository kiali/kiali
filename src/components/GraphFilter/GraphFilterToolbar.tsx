import * as React from 'react';
import { PropTypes } from 'prop-types';

import { GraphParamsType, GraphType } from '../../types/Graph';
import { Duration } from '../../types/GraphFilter';
import Namespace from '../../types/Namespace';
import GraphFilterToolbarType from '../../types/GraphFilterToolbar';

import { makeServiceGraphUrlFromParams } from '../Nav/NavUtils';

import GraphFilter from './GraphFilter';

export default class GraphFilterToolbar extends React.PureComponent<GraphFilterToolbarType> {
  static contextTypes = {
    router: PropTypes.object
  };

  render() {
    const graphParams: GraphParamsType = {
      namespace: this.props.namespace,
      graphLayout: this.props.graphLayout,
      graphDuration: this.props.graphDuration,
      edgeLabelMode: this.props.edgeLabelMode,
      graphType: this.props.graphType
    };

    return (
      <GraphFilter
        disabled={this.props.isLoading}
        onDurationChange={this.handleDurationChange}
        onNamespaceChange={this.handleNamespaceChange}
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

  handleGraphTypeChange = (graphType: GraphType) => {
    this.handleFilterChange({
      ...this.getGraphParams(),
      graphType
    });
  };

  handleFilterChange = (params: GraphParamsType) => {
    this.context.router.history.push(makeServiceGraphUrlFromParams(params));
  };

  private getGraphParams: () => GraphParamsType = () => {
    return {
      namespace: this.props.namespace,
      graphDuration: this.props.graphDuration,
      graphLayout: this.props.graphLayout,
      edgeLabelMode: this.props.edgeLabelMode,
      graphType: this.props.graphType
    };
  };
}
