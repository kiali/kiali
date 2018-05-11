import * as React from 'react';
import { Toolbar, Button, Icon, FormGroup } from 'patternfly-react';

import { Duration, Layout } from '../../types/GraphFilter';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import NamespaceDropdownContainer from '../../containers/NamespaceDropdownContainer';
import { config } from '../../config';
import GraphLayersContainer from '../../containers/GraphLayersContainer';
import { style } from 'typestyle';
import { GraphParamsType } from '../../types/Graph';
import Namespace from '../../types/Namespace';

export interface GraphFilterProps extends GraphParamsType {
  disabled: boolean;
  onLayoutChange: (newLayout: Layout) => void;
  onFilterChange: (newDuration: Duration) => void;
  onNamespaceChange: (newValue: Namespace) => void;
  onRefresh: () => void;
}

export interface GraphFilterState {}

const zeroPaddingLeft = style({
  paddingLeft: '0px'
});
const labelPaddingRight = style({
  paddingRight: '0.5em'
});

export default class GraphFilter extends React.Component<GraphFilterProps, GraphFilterState> {
  // TODO:  We should keep these mappings with their corresponding filtering components.
  // GraphFilter should be minimal and used for assembling those filtering components.
  static readonly INTERVAL_DURATION = config().toolbar.intervalDuration;
  static readonly GRAPH_LAYOUTS = config().toolbar.graphLayouts;

  constructor(props: GraphFilterProps) {
    super(props);
  }

  updateDuration = (value: number) => {
    if (this.props.graphDuration.value !== value) {
      // notify callback
      sessionStorage.setItem('appDuration', String(value));
      this.props.onFilterChange({ value: value });
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
            initialValue={Number(sessionStorage.getItem('appDuration')) || this.props.graphDuration.value}
            initialLabel={String(
              GraphFilter.INTERVAL_DURATION[
                Number(sessionStorage.getItem('appDuration')) || config().toolbar.defaultDuration
              ]
            )}
            options={GraphFilter.INTERVAL_DURATION}
          />
          <ToolbarDropdown
            id={'graph_filter_layouts'}
            disabled={this.props.disabled}
            handleSelect={this.updateLayout}
            nameDropdown={'Layout'}
            initialValue={this.props.graphLayout.name}
            initialLabel={String(GraphFilter.GRAPH_LAYOUTS[this.props.graphLayout.name])}
            options={GraphFilter.GRAPH_LAYOUTS}
          />
          <FormGroup className={zeroPaddingLeft}>
            <label className={labelPaddingRight}>Filters:</label>
            <GraphLayersContainer />
          </FormGroup>
          <Toolbar.RightContent>
            <Button disabled={this.props.disabled} onClick={this.handleRefresh}>
              <Icon name="refresh" />
            </Button>
          </Toolbar.RightContent>
        </Toolbar>
      </>
    );
  }
}
