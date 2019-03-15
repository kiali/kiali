import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import TrafficPolicy from '../components/IstioWizards/TrafficPolicy';
import { meshWideMTLSStatusSelector } from '../store/Selectors';

const mapStateToProps = (state: KialiAppState) => ({
  meshWideStatus: meshWideMTLSStatusSelector(state)
});

const TraffiPolicyConnected = connect(mapStateToProps)(TrafficPolicy);
export default TraffiPolicyConnected;
