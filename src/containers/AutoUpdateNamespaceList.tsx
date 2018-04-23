import { connect } from 'react-redux';

import { fetchNamespacesIfNeeded } from '../actions/NamespaceAction';
import { NamespaceDropdown } from '../components/NamespaceDropdown';

const mapStateToProps = state => {
  console.log('mapStateToProps', state);
  return {
    items: state.namespaces.items
  };
};
const mapDispatchToProps = dispatch => {
  return {
    refresh: () => {
      dispatch(fetchNamespacesIfNeeded());
    }
  };
};

const AutoUpdateNamespaceList = connect(mapStateToProps, mapDispatchToProps)(NamespaceDropdown);
export default AutoUpdateNamespaceList;
