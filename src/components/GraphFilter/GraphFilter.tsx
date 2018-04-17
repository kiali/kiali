import * as React from 'react';
import { Button, ButtonGroup, DropdownButton, MenuItem } from 'patternfly-react';
import { ButtonToolbar, Glyphicon } from 'react-bootstrap';

import { GraphFilterProps, GraphFilterState } from '../../types/GraphFilter';
import * as API from '../../services/Api';
import { DurationDropdown } from './DurationDropdown';
import { LayoutButtonGroup } from './LayoutButtonGroup';

export default class GraphFilter extends React.Component<GraphFilterProps, GraphFilterState> {
  constructor(props: GraphFilterProps) {
    super(props);
    this.state = {
      availableNamespaces: []
    };
  }

  componentDidMount() {
    // TODO: [KIALI-436] API.GetNamespaces() is also called in Services component.
    // We should consolidate them into one.
    API.GetNamespaces()
      .then(this.setNamespaces)
      .catch(error => {
        this.props.onError(error);
      });
  }

  setNamespaces = (response: any) => {
    this.setState({ availableNamespaces: response['data'] });
  };

  updateDuration = (value: string) => {
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

  render() {
    return (
      <div>
        <ButtonToolbar>
          <ButtonGroup>
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
          </ButtonGroup>
          <DurationDropdown
            disabled={this.props.disabled}
            onClick={this.updateDuration}
            initialDuration={this.props.activeDuration.value}
          />
          <LayoutButtonGroup
            disabled={this.props.disabled}
            onClick={this.updateLayout}
            initialLayout={this.props.activeLayout.name}
          />
          <ButtonGroup className="pull-right">
            <Button disabled={this.props.disabled} onClick={this.handleRefresh}>
              <Glyphicon glyph="refresh" />
            </Button>
          </ButtonGroup>
        </ButtonToolbar>
      </div>
    );
  }
}
