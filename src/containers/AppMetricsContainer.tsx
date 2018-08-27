import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import GraphPage from '../components/Metrics/Metrics';

const mapStateToProps = (state: KialiAppState) => ({
  isPageVisible: state.globalState.isPageVisible
});

const AppMetricsConnected = connect(mapStateToProps)(GraphPage);

export default AppMetricsConnected;
