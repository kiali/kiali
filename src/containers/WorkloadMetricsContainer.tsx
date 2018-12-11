import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import Metrics, { MetricsProps } from '../components/Metrics/Metrics';

const mapStateToProps = (state: KialiAppState) => ({
  isPageVisible: state.globalState.isPageVisible,
  grafanaInfo: state.grafanaInfo
});

const WorkloadMetricsConnected = withRouter<RouteComponentProps<{}> & MetricsProps>(connect(mapStateToProps)(Metrics));

export default WorkloadMetricsConnected;
