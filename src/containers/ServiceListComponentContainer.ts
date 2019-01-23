import { connect } from 'react-redux';

import { KialiAppState } from '../store/Store';
import ServiceListComponent from '../pages/ServiceList/ServiceListComponent';
import { activeNamespacesSelector } from '../store/Selectors';

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state)
});

const ServiceListComponentContainer = connect(
  mapStateToProps,
  null
)(ServiceListComponent);
export default ServiceListComponentContainer;
