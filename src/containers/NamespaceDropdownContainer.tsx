import { connect } from 'react-redux';

import { NamespaceActions } from '../actions/NamespaceAction';
import { NamespaceDropdown } from '../components/NamespaceDropdown';

const mapStateToProps = state => {
  return {
    items: state.namespaces.items
  };
};

const mapDispatchToProps = dispatch => {
  return {
    refresh: () => {
      dispatch(NamespaceActions.fetchNamespacesIfNeeded());
    }
  };
};

const NamespaceDropdownContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(NamespaceDropdown);
export default NamespaceDropdownContainer;
