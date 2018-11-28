import * as React from 'react';
import { connect } from 'react-redux';
import { Dispatch } from 'redux';
import { KialiAppState } from '../store/Store';
import { activeNamespacesSelector, namespaceItemsSelector } from '../store/Selectors';
import { GraphActions } from '../actions/GraphActions';
import { NamespaceActions, NamespaceThunkActions } from '../actions/NamespaceAction';
import Namespace, { namespaceFromString } from '../types/Namespace';
import ToolbarDropdown from './ToolbarDropdown/ToolbarDropdown';

interface NamespaceListType {
  disabled: boolean;
  activeNamespace: Namespace;
  items: Namespace[];
  setActiveNamespace: (namespace: Namespace) => void;
  refresh: () => void;
}

export class NamespaceDropdown extends React.PureComponent<NamespaceListType, {}> {
  constructor(props: NamespaceListType) {
    super(props);
  }

  componentDidMount() {
    this.props.refresh();
  }

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
        handleSelect={this.props.setActiveNamespace}
        onToggle={this.handleToggle}
      />
    );
  }
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    items: namespaceItemsSelector(state),
    activeNamespace: activeNamespacesSelector(state)[0]
  };
};

const mapDispatchToProps = (dispatch: Dispatch<any>) => {
  return {
    refresh: () => {
      dispatch(NamespaceThunkActions.fetchNamespacesIfNeeded());
    },
    setActiveNamespace: (namespace: string) => {
      // TODO: This needs to be a single update
      dispatch(GraphActions.changed());
      dispatch(NamespaceActions.setActiveNamespaces([namespaceFromString(namespace)]));
    }
  };
};

const NamespaceDropdownContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(NamespaceDropdown);
export default NamespaceDropdownContainer;
