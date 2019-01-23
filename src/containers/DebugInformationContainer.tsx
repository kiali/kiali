import { connect } from 'react-redux';
import { KialiAppState } from '../store/Store';
import DebugInformation from '../components/DebugInformation/DebugInformation';

const mapStateToProps = (state: KialiAppState) => ({
  appState: state
});

const DebugInformationContainer = connect(
  mapStateToProps,
  null,
  null,
  { withRef: true }
)(DebugInformation);

export default DebugInformationContainer;
