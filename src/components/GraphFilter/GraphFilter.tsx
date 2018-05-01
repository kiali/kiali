import * as React from 'react';
import { Toolbar, Button, ButtonGroup, Switch, Icon, FormGroup } from 'patternfly-react';

import { GraphFilterProps, GraphFilterState } from '../../types/GraphFilter';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import AutoUpdateNamespaceList from '../../containers/AutoUpdateNamespaceList';
import { config } from '../../config';
import GraphLayersConnected from '../../containers/GraphLayers/GraphLayers';

export default class GraphFilter extends React.Component<GraphFilterProps, GraphFilterState> {
  // TODO:  We should keep these mappings with their corresponding filtering components.
  // GraphFilter should be minimal and used for assembling those filtering components.
  static INTERVAL_DURATION = config().toolbar.intervalDuration;
  static GRAPH_LAYOUTS = config().toolbar.graphLayouts;

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

  handleToggleCBs = (event: any) => {
    this.props.onBadgeStatusChange({
      hideCBs: !this.props.badgeStatus.hideCBs,
      hideRRs: this.props.badgeStatus.hideRRs
    });
  };

  handleToggleRRs = (event: any) => {
    this.props.onBadgeStatusChange({
      hideCBs: this.props.badgeStatus.hideCBs,
      hideRRs: !this.props.badgeStatus.hideRRs
    });
  };

  render() {
    // TODO, these inline styles could moveto typestyle
    const zeroPaddingLeft = {
      paddingLeft: '0px'
    };
    const labelPaddingRight = {
      paddingRight: '0.5em'
    };
    const buttonPaddingLeft = {
      paddingLeft: '5px'
    };

    return (
      <>
        <Toolbar>
          <FormGroup style={zeroPaddingLeft}>
            <label style={labelPaddingRight}>Namespace:</label>
            <AutoUpdateNamespaceList
              disabled={this.props.disabled}
              activeNamespace={this.props.namespace}
              onSelect={this.props.onNamespaceChange}
            />
          </FormGroup>
          <ToolbarDropdown
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
            disabled={this.props.disabled}
            handleSelect={this.updateLayout}
            nameDropdown={'Layout'}
            initialValue={this.props.graphLayout.name}
            initialLabel={String(GraphFilter.GRAPH_LAYOUTS[this.props.graphLayout.name])}
            options={GraphFilter.GRAPH_LAYOUTS}
          />
          <Toolbar.RightContent>
            <Button disabled={this.props.disabled} onClick={this.handleRefresh}>
              <Icon name="refresh" />
            </Button>
          </Toolbar.RightContent>
        </Toolbar>
        <Toolbar>
          <ButtonGroup>
            <Switch
              labelText="Circuit Breakers"
              disabled={this.props.disabled}
              value={!this.props.badgeStatus.hideCBs}
              onChange={this.handleToggleCBs}
            />
          </ButtonGroup>
          <ButtonGroup style={buttonPaddingLeft}>
            <Switch
              labelText="Route Rules"
              disabled={this.props.disabled}
              value={!this.props.badgeStatus.hideRRs}
              onChange={this.handleToggleRRs}
            />
          </ButtonGroup>
          <GraphLayersConnected />
        </Toolbar>
      </>
    );
  }
}
