import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import IstioMetrics, { IstioMetricsProps } from '../components/Metrics/IstioMetrics';

const mapStateToProps = (state: KialiAppState) => ({
  isPageVisible: state.globalState.isPageVisible
});

const AppMetricsConnected = withRouter<RouteComponentProps<{}> & IstioMetricsProps>(
  connect(mapStateToProps)(IstioMetrics)
);

export default AppMetricsConnected;
