import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import HelpDropdown from '../components/Nav/HelpDropdown';

const mapStateToProps = (state: KialiAppState) => ({
  status: state.statusState.status,
  components: state.statusState.components,
  warningMessages: state.statusState.warningMessages
});

const HelpDropdownConnected = connect(mapStateToProps)(HelpDropdown);
export default HelpDropdownConnected;
