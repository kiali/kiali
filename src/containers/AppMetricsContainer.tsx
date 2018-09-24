import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import GraphPage, { MetricsProps } from '../components/Metrics/Metrics';
import { RouteComponentProps, withRouter } from 'react-router';

const mapStateToProps = (state: KialiAppState) => ({
  isPageVisible: state.globalState.isPageVisible
});

const AppMetricsConnected = withRouter<RouteComponentProps<{}> & MetricsProps>(connect(mapStateToProps)(GraphPage));

export default AppMetricsConnected;
