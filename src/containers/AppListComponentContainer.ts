import { connect } from 'react-redux';

import { KialiAppState } from '../store/Store';
import AppListComponent from '../pages/AppList/AppListComponent';
import { activeNamespacesSelector } from '../store/Selectors';

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state)
});

const AppListComponentContainer = connect(
  mapStateToProps,
  null
)(AppListComponent);
export default AppListComponentContainer;
