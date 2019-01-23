import { connect } from 'react-redux';

import { KialiAppState } from '../store/Store';
import IstioConfigListComponent from '../pages/IstioConfigList/IstioConfigListComponent';
import { activeNamespacesSelector } from '../store/Selectors';

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state)
});

const IstioConfigListComponentContainer = connect(
  mapStateToProps,
  null
)(IstioConfigListComponent);
export default IstioConfigListComponentContainer;
