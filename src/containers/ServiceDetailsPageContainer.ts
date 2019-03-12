import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import ServiceDetailsPage from '../pages/ServiceDetails/ServiceDetailsPage';

const mapStateToProps = (state: KialiAppState) => ({
  jaegerUrl: state.jaegerState.jaegerURL,
  jaegerIntegration: state.jaegerState.enableIntegration
});

const ServiceDetailsPageContainer = connect(mapStateToProps)(ServiceDetailsPage);
export default ServiceDetailsPageContainer;
