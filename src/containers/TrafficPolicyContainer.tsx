import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import TrafficPolicy from '../components/IstioWizards/TrafficPolicy';

const mapStateToProps = (state: KialiAppState) => ({
  status: state.statusState.status
});

const TraffiPolicyConnected = connect(mapStateToProps)(TrafficPolicy);
export default TraffiPolicyConnected;
