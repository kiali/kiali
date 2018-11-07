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

  handleSelectNamespace = (namespace: string) => {
    this.props.onSelect({ name: namespace });
  };

  handleToggle = (isOpen: boolean) => isOpen && this.props.refresh();

  render() {
    const disabled = this.props.disabled;

    // convert namespace array to an object {"ns1": "ns1"} to make it compatible with <ToolbarDropdown />
    const items: { [key: string]: string } = this.props.items.reduce((list, item) => {
      list[item.name] = item.name;
      return list;
    }, {});

    return (
      <ToolbarDropdown
        id="namespace-selector"
        disabled={disabled}
        options={items}
        value={this.props.activeNamespace.name}
        label={this.props.activeNamespace.name}
        useName={true}
        handleSelect={this.handleSelectNamespace}
        onToggle={this.handleToggle}
      />
    );
  }
}
