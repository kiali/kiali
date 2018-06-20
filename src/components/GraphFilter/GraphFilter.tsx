import * as React from 'react';
import { Toolbar, FormGroup } from 'patternfly-react';

import { Duration, Layout, EdgeLabelMode } from '../../types/GraphFilter';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import NamespaceDropdownContainer from '../../containers/NamespaceDropdownContainer';
import { config } from '../../config';
import GraphLayersContainer from '../../containers/GraphLayersContainer';
import { style } from 'typestyle';
import { GraphParamsType } from '../../types/Graph';
import Namespace from '../../types/Namespace';
import GraphRefreshContainer from '../../containers/GraphRefreshContainer';

import * as _ from 'lodash';

export interface GraphFilterProps extends GraphParamsType {
  disabled: boolean;
  onLayoutChange: (newLayout: Layout) => void;
  onDurationChange: (newDuration: Duration) => void;
  onNamespaceChange: (newValue: Namespace) => void;
  onEdgeLabelModeChange: (newEdges: EdgeLabelMode) => void;
  onRefresh: () => void;
  // onLegend: () => void;
  // hideLegend: boolean;
}

const zeroPaddingLeft = style({
  paddingLeft: '0px'
});
const labelPaddingRight = style({
  paddingRight: '0.5em'
});

export default class GraphFilter extends React.PureComponent<GraphFilterProps> {
  // TODO:  We should keep these mappings with their corresponding filtering components.
  // GraphFilter should be minimal and used for assembling those filtering components.
  static readonly INTERVAL_DURATION = config().toolbar.intervalDuration;
  static readonly GRAPH_LAYOUTS = config().toolbar.graphLayouts;
  static readonly EDGE_LABEL_MODES = EdgeLabelMode.getValues().reduce((map, edgeLabelMode) => {
    map[edgeLabelMode] = _.capitalize(_.startCase(edgeLabelMode));
    return map;
  }, {});

  constructor(props: GraphFilterProps) {
    super(props);
  }

  updateDuration = (value: number) => {
    if (this.props.graphDuration.value !== value) {
      // notify callback
      this.props.onDurationChange({ value: value });
    }
  };

  updateLayout = (value: string) => {
    if ('cose' === value || this.props.graphLayout.name !== value) {
      // notify callback
      this.props.onLayoutChange({ name: value });
    }
  };

  updateNamespace = (selected: string) => {
    if (this.props.namespace.name !== selected) {
      // notify callback
      this.props.onNamespaceChange({ name: selected });
    }
  };

  updateEdges = (selected: EdgeLabelMode) => {
    if (this.props.edgeLabelMode !== selected) {
      // notify callback
      this.props.onEdgeLabelModeChange(selected);
    }
  };

  handleRefresh = (e: any) => {
    this.props.onRefresh();
  };

  render() {
    return (
      <>
        <Toolbar>
          <FormGroup className={zeroPaddingLeft}>
            <label className={labelPaddingRight}>Namespace:</label>
            <NamespaceDropdownContainer
              disabled={this.props.disabled}
              activeNamespace={this.props.namespace}
              onSelect={this.props.onNamespaceChange}
            />
          </FormGroup>
          <ToolbarDropdown
            id={'graph_filter_interval_duration'}
            disabled={this.props.disabled}
            handleSelect={this.updateDuration}
            nameDropdown={'Duration'}
            value={this.props.graphDuration.value}
            label={String(GraphFilter.INTERVAL_DURATION[this.props.graphDuration.value])}
            options={GraphFilter.INTERVAL_DURATION}
          />
          <ToolbarDropdown
            id={'graph_filter_layouts'}
            disabled={this.props.disabled}
            handleSelect={this.updateLayout}
            nameDropdown={'Layout'}
            value={this.props.graphLayout.name}
            label={String(GraphFilter.GRAPH_LAYOUTS[this.props.graphLayout.name])}
            options={GraphFilter.GRAPH_LAYOUTS}
          />
          <ToolbarDropdown
            id={'graph_filter_edges'}
            disabled={this.props.disabled}
            handleSelect={this.updateEdges}
            nameDropdown={'Edge Labels'}
            value={this.props.edgeLabelMode}
            label={GraphFilter.EDGE_LABEL_MODES[this.props.edgeLabelMode]}
            options={GraphFilter.EDGE_LABEL_MODES}
          />
          <FormGroup className={zeroPaddingLeft}>
            <label className={labelPaddingRight}>Filters:</label>
            <GraphLayersContainer />
          </FormGroup>
          <Toolbar.RightContent>
            <FormGroup className={zeroPaddingLeft}>
              <GraphRefreshContainer id="refresh-button" handleRefresh={this.handleRefresh} />
            </FormGroup>
          </Toolbar.RightContent>
        </Toolbar>
      </>
    );
  }
}
