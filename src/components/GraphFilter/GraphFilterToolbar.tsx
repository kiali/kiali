import * as React from 'react';
import { PropTypes } from 'prop-types';

import { GraphParamsType } from '../../types/Graph';
import { Duration, Layout, EdgeLabelMode, PollInterval } from '../../types/GraphFilter';
import Namespace from '../../types/Namespace';
import GraphFilterToolbarType from '../../types/GraphFilterToolbar';

import { makeURLFromParams } from '../../components/Nav/NavUtils';

import GraphFilter from './GraphFilter';

export default class GraphFilterToolbar extends React.PureComponent<GraphFilterToolbarType, {}> {
  static contextTypes = {
    router: PropTypes.object
  };

  render() {
    const graphParams: GraphParamsType = {
      namespace: this.props.namespace,
      graphLayout: this.props.graphLayout,
      graphDuration: this.props.graphDuration,
      edgeLabelMode: this.props.edgeLabelMode,
      pollInterval: this.props.pollInterval
    };

    return (
      <GraphFilter
        disabled={this.props.isLoading}
        onLayoutChange={this.handleLayoutChange}
        onDurationChange={this.handleDurationChange}
        onNamespaceChange={this.handleNamespaceChange}
        onEdgeLabelModeChange={this.handleEdgeLabelModeChange}
        onRefresh={this.props.handleRefreshClick}
        onPollIntervalChanged={this.handlePollIntervalChanged}
        onLegend={this.props.handleLegendClick}
        hideLegend={this.props.hideLegend}
        isLoading={this.props.isLoading}
        {...graphParams}
      />
    );
  }

  handleLayoutChange = (graphLayout: Layout) => {
    this.handleFilterChange({
      ...this.getGraphParams(),
      graphLayout
    });
  };

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

  handleEdgeLabelModeChange = (edgeLabelMode: EdgeLabelMode) => {
    this.handleFilterChange({ ...this.getGraphParams(), edgeLabelMode });
  };

  handlePollIntervalChanged = (pollInterval: PollInterval) => {
    this.handleFilterChange({
      ...this.getGraphParams(),
      pollInterval
    });
  };

  handleFilterChange = (params: GraphParamsType) => {
    this.context.router.history.push(makeURLFromParams(params));
  };

  private getGraphParams: () => GraphParamsType = () => {
    return {
      namespace: this.props.namespace,
      graphDuration: this.props.graphDuration,
      graphLayout: this.props.graphLayout,
      edgeLabelMode: this.props.edgeLabelMode,
      pollInterval: this.props.pollInterval
    };
  };
}
