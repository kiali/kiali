import { Component, KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import ServiceDetailsPage from '../pages/ServiceDetails/ServiceDetailsPage';

const getJaegerUrl = (components: Component[]) => {
  const jaegerinfo = components.find(comp => comp.name === 'Jaeger');
  return jaegerinfo ? jaegerinfo.url : '';
};

const mapStateToProps = (state: KialiAppState) => ({
  jaegerUrl: getJaegerUrl(state.statusState.components),
  enableIntegration: state.jaegerState.enableIntegration
});

const ServiceDetailsPageContainer = connect(mapStateToProps)(ServiceDetailsPage);
export default ServiceDetailsPageContainer;
