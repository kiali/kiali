import * as React from 'react';
import { Toolbar, Button, ButtonGroup, DropdownButton, MenuItem, Switch, Icon } from 'patternfly-react';

import { GraphFilterProps, GraphFilterState } from '../../types/GraphFilter';
import * as API from '../../services/Api';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';

export default class GraphFilter extends React.Component<GraphFilterProps, GraphFilterState> {
  constructor(props: GraphFilterProps) {
    super(props);
    this.state = {
      availableNamespaces: []
    };
  }

  componentDidMount() {
    // TODO: [KIALI-436] API.getNamespaces() is also called in Services component.
    // We should consolidate them into one.
    API.getNamespaces()
      .then(this.setNamespaces)
      .catch(error => {
        this.props.onError(error);
      });
  }

  setNamespaces = (response: any) => {
    this.setState({ availableNamespaces: response['data'] });
  };

  updateDuration = (value: number) => {
    if (this.props.activeDuration.value !== value) {
      // notify callback
      this.props.onFilterChange({ value: value });
    }
  };

  updateLayout = (value: string) => {
    if (this.props.activeLayout.name !== value) {
      // notify callback
      this.props.onLayoutChange({ name: value });
    }
  };

  updateNamespace = (selected: string) => {
    if (this.props.activeNamespace.name !== selected) {
      // notify callback
      this.props.onNamespaceChange({ name: selected });
    }
  };

  handleRefresh = (e: any) => {
    this.props.onRefresh();
  };

  handleToggleCBs = () => {
    this.props.onBadgeStatusChange({ hideCBs: !this.props.activeBadgeStatus.hideCBs });
  };

  render() {
    const intervalDurations = [
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
    const graphsTypes = [
      ['breadthfirst', 'Breadthfirst'],
      ['cola', 'Cola'],
      ['cose', 'Cose'],
      ['dagre', 'Dagre'],
      ['klay', 'Klay']
    ];

    return (
      <div>
        <Toolbar>
          <div className="form-group">
            <DropdownButton
              disabled={this.props.disabled}
              id="namespace-selector"
              title={this.props.activeNamespace.name}
              onSelect={this.updateNamespace}
            >
              {this.state.availableNamespaces.map(ns => (
                <MenuItem key={ns.name} active={ns.name === this.props.activeNamespace.name} eventKey={ns.name}>
                  {ns.name}
                </MenuItem>
              ))}
            </DropdownButton>
          </div>
          <ToolbarDropdown
            disabled={this.props.disabled}
            onClick={this.updateDuration}
            nameDropdown={'Duration'}
            initialValue={this.props.activeDuration.value}
            initialLabel={String(
              intervalDurations.filter(elem => {
                return elem[0] === Number(this.props.activeDuration.value);
              })[0][1]
            )}
            options={intervalDurations}
          />
          <ToolbarDropdown
            disabled={this.props.disabled}
            onClick={this.updateLayout}
            nameDropdown={'Graph Type'}
            initialValue={this.props.activeLayout.name}
            initialLabel={String(
              graphsTypes.filter(elem => {
                return elem[0] === String(this.props.activeLayout.name);
              })[0][1]
            )}
            options={graphsTypes}
          />
          <Toolbar.RightContent>
            <Button disabled={this.props.disabled} onClick={this.handleRefresh}>
              <Icon name="refresh" />
            </Button>
          </Toolbar.RightContent>
        </Toolbar>
        <div style={{ paddingTop: '10px' }}>
          <ButtonGroup>
            <Switch labelText="Show Circuit Breakers" disabled={this.props.disabled} onChange={this.handleToggleCBs} />
          </ButtonGroup>
        </div>
      </div>
    );
  }
}
