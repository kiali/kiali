import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import MeshMTLSStatus from '../components/Nav/MeshMTLSStatus';

const mapStateToProps = (state: KialiAppState) => ({
  status: state.statusState.status,
  components: state.statusState.components,
  warningMessages: state.statusState.warningMessages
});

const GlobalMTLSSatutsConnected = connect(mapStateToProps)(MeshMTLSStatus);
export default GlobalMTLSSatutsConnected;
