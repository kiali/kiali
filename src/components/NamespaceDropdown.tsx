import * as React from 'react';
import { DropdownButton, MenuItem } from 'patternfly-react';

import Namespace from '../types/Namespace';

interface NamespaceListType {
  disabled: boolean;
  activeNamespace: Namespace;
  items: Namespace[];
  onSelect: (newValue: Namespace) => void;
  refresh: () => void;
}

export class NamespaceDropdown extends React.PureComponent<NamespaceListType, {}> {
  constructor(props: NamespaceListType) {
    super(props);
  }
  componentDidMount() {
    this.props.refresh();
  }

  onSelectTypesafe = (value: string) => {
    this.props.refresh();
    this.props.onSelect({ name: value });
  };

  render() {
    const disabled = this.props.disabled ? true : false;
    return (
      <DropdownButton
        disabled={disabled}
        id="namespace-selector"
        title={this.props.activeNamespace.name}
        onSelect={this.onSelectTypesafe}
      >
        {this.props.items &&
          this.props.items.map(ns => (
            <MenuItem key={ns.name} active={ns.name === this.props.activeNamespace.name} eventKey={ns.name}>
              {ns.name}
            </MenuItem>
          ))}
      </DropdownButton>
    );
  }
}
