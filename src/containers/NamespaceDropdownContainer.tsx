import { connect } from 'react-redux';

import { GraphActions } from '../actions/GraphActions';
import { NamespaceActions, NamespaceThunkActions } from '../actions/NamespaceAction';
import { NamespaceDropdown } from '../components/NamespaceDropdown';
import Namespace from '../types/Namespace';
import { KialiAppState } from '../store/Store';
import { Dispatch } from 'redux';
import { activeNamespacesSelector, namespaceItemsSelector } from '../store/Selectors';

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
    onSelect: (namespace: Namespace) => {
      dispatch(GraphActions.changed());
      dispatch(NamespaceActions.setActiveNamespaces([namespace]));
    }
  };
};

const NamespaceDropdownContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(NamespaceDropdown);
export default NamespaceDropdownContainer;
