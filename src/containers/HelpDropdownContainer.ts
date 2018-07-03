import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import HelpDropdown from '../components/Nav/HelpDropdown';

import { HelpDropdownActions } from '../actions/HelpDropdownActions';

const mapStateToProps = (state: KialiAppState) => ({
  status: state.statusState.status,
  components: state.statusState.components,
  warningMessages: state.statusState.warningMessages
});

const mapDispatchToProps = (dispatch: any) => ({
  refresh: () => dispatch(HelpDropdownActions.refresh())
});

const HelpDropdownConnected = connect(
  mapStateToProps,
  mapDispatchToProps
)(HelpDropdown);
export default HelpDropdownConnected;
