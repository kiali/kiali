import * as React from 'react';
import { Toolbar, Button, ButtonGroup, Switch, Icon } from 'patternfly-react';

import { GraphFilterProps, GraphFilterState } from '../../types/GraphFilter';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import AutoUpdateNamespaceList from '../../containers/AutoUpdateNamespaceList';

export default class GraphFilter extends React.Component<GraphFilterProps, GraphFilterState> {
  // TODO:  We should keep these mappings with their corresponding filtering components.
  // GraphFilter should be minimal and used for assembling those filtering components.
  static INTERVAL_DURATION = [
    [60, '1 minute'],
    [600, '10 minutes'],
    [1800, '30 minutes'],
    [3600, '1 hour'],
    [14400, '4 hours'],
    [28800, '8 hours'],
    [86400, '1 day'],
    [604800, '7 days'],
    [2592000, '30 days']
  ];
  static GRAPH_LAYOUTS = [
    ['breadthfirst', 'Breadthfirst'],
    ['cola', 'Cola'],
    ['cose', 'Cose'],
    ['dagre', 'Dagre'],
    ['klay', 'Klay']
  ];
  constructor(props: GraphFilterProps) {
    super(props);
  }

  updateDuration = (value: number) => {
    if (this.props.graphDuration.value !== value) {
      // notify callback
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

  handleToggleCBs = (newValue: boolean) => {
    this.props.onBadgeStatusChange({ hideCBs: !this.props.badgeStatus.hideCBs });
  };

  render() {
    return (
      <>
        <Toolbar>
          <div className="form-group">
            <AutoUpdateNamespaceList
              disabled={this.props.disabled}
              activeNamespace={this.props.namespace}
              onSelect={this.props.onNamespaceChange}
            />
          </div>
          <ToolbarDropdown
            disabled={this.props.disabled}
            onClick={this.updateDuration}
            nameDropdown={'Duration'}
            initialValue={this.props.graphDuration.value}
            initialLabel={String(
              GraphFilter.INTERVAL_DURATION.filter(elem => {
                return elem[0] === Number(this.props.graphDuration.value);
              })[0][1]
            )}
            options={GraphFilter.INTERVAL_DURATION}
          />
          <ToolbarDropdown
            disabled={this.props.disabled}
            onClick={this.updateLayout}
            nameDropdown={'Layout'}
            initialValue={this.props.graphLayout.name}
            initialLabel={String(
              GraphFilter.GRAPH_LAYOUTS.filter(elem => {
                return elem[0] === String(this.props.graphLayout.name);
              })[0][1]
            )}
            options={GraphFilter.GRAPH_LAYOUTS}
          />
          <Toolbar.RightContent>
            <Button disabled={this.props.disabled} onClick={this.handleRefresh}>
              <Icon name="refresh" />
            </Button>
          </Toolbar.RightContent>
        </Toolbar>
        <div style={{ paddingTop: '10px' }}>
          <ButtonGroup>
            <Switch
              labelText="Show Circuit Breakers"
              disabled={this.props.disabled}
              value={this.props.badgeStatus.hideCBs}
              onChange={this.handleToggleCBs}
            />
          </ButtonGroup>
        </div>
      </>
    );
  }
}
