import * as React from 'react';
import { ButtonGroup, DropdownButton, MenuItem, Toolbar } from 'patternfly-react';
import { ButtonToolbar } from 'react-bootstrap';

import { GraphFilterProps, GraphFilterState } from '../../types/GraphFilter';
import * as API from '../../services/Api';
import { DurationButtonGroup } from './DurationButtonGroup';
import { LayoutButtonGroup } from './LayoutButtonGroup';

export class GraphFilter extends React.Component<GraphFilterProps, GraphFilterState> {
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

  updateInterval = (value: string) => {
    if (this.props.activeInterval.value !== value) {
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

  render() {
    return (
      <div>
        <ButtonToolbar>
          <ButtonGroup>
            <DropdownButton
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
          <DurationButtonGroup onClick={this.updateInterval} initialDuration={this.props.activeInterval.value} />
          <LayoutButtonGroup onClick={this.updateLayout} initialLayout={this.props.activeLayout.name} />
        </ButtonToolbar>
        <Toolbar />
      </div>
    );
  }
}

export default GraphFilter;
