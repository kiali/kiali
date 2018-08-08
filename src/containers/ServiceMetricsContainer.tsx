import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import ServiceGraphPage from '../pages/ServiceDetails/ServiceMetrics';

const mapStateToProps = (state: KialiAppState) => ({
  isPageVisible: state.globalState.isPageVisible
});

const ServiceMetricsConnected = connect(mapStateToProps)(ServiceGraphPage);

export default ServiceMetricsConnected;
