import * as React from 'react';

import Namespace from '../types/Namespace';
import ToolbarDropdown from './ToolbarDropdown/ToolbarDropdown';

interface NamespaceListType {
  disabled: boolean;
  activeNamespace: Namespace;
  items: Namespace[];
  onSelect: (namespace: Namespace) => void;
  refresh: () => void;
}

export class NamespaceDropdown extends React.PureComponent<NamespaceListType, {}> {
  constructor(props: NamespaceListType) {
    super(props);
  }

  componentDidMount() {
    this.props.refresh();
  }

  handleSelectNamespace = (namespace: string) => this.props.onSelect({ name: namespace });

  render() {
    const disabled = this.props.disabled ? true : false;

    const items = this.props.items.map(ns => {
      return ns.name;
    });

    return (
      <ToolbarDropdown
        disabled={disabled}
        useName={true}
        id="namespace-selector"
        initialLabel={this.props.activeNamespace.name}
        handleSelect={this.handleSelectNamespace}
        value={this.props.activeNamespace.name}
        options={items}
      />
    );
  }
}
